import type { Plan } from "@prisma/client"
import { PLAN_LIMITS, getProjectLimitForPlan, getPromptLimitForPlan } from "./plan_config"
import type { LimitCheckResponse, SubscriptionLimitFeature } from "./subscription_types"

// This module is the single source of truth for the brand-workspace limit, and it is kept
// free of runtime imports (prisma, Stripe) so that both the enforcement path and the
// reporting endpoint — and a plain `tsx` test — can use the same rules.

export const TRIAL_PROJECT_LIMIT = 1
export const TRIAL_PROMPT_LIMIT = 10

// How many AI engines a free product trial may track. It lives here, next to the other trial
// caps, because two places need the same number and they had drifted apart: the quota
// endpoint reported the GROWTH entitlement ("all", i.e. every engine) while the engine check
// on the create path still rejected anything above three. Onboarding believed the quota, let
// a trial user select four or five engines, and then the launch failed and dropped them back
// on the engine step with no way to get past it.
export const TRIAL_ENGINE_LIMIT = 3

// ── Credits as extra capacity ────────────────────────────────────────────────
//
// A plan's cap is the baseline the subscription includes, not a hard ceiling: an account that
// has reached it may go further while it holds enough credits to pay for what the extra
// capacity will actually consume. That is the whole point of selling plans and credit packs
// side by side — the plan sets what you get for the monthly fee, credits let you exceed it
// without being forced onto the next tier.
//
// The reserves below are derived rather than picked, so there is one number to retune instead
// of three. A tracked prompt runs once a day on up to MAX_TRACKED_ENGINES engines, and one
// prompt-engine job costs one credit (ACCOUNT_CREDIT_POLICY.prompt_run), so a prompt costs
// MAX_TRACKED_ENGINES credits a day. EXTRA_CAPACITY_DAYS is how much runway an account must be
// able to fund before it is allowed to take on capacity its plan does not include — a week, so
// that going over the cap is a deliberate purchase and not something a near-empty wallet slips
// into and then stalls on halfway through the next run.
const MAX_TRACKED_ENGINES = 5
const EXTRA_CAPACITY_DAYS = 7

/** Credits an account must hold per prompt it tracks beyond its plan's allowance. */
export const EXTRA_PROMPT_CREDIT_RESERVE = MAX_TRACKED_ENGINES * EXTRA_CAPACITY_DAYS

/**
 * A brand workspace is only worth what is tracked inside it, so an extra workspace reserves a
 * workspace's worth of prompts. Ten is the onboarding wizard's own launch size
 * (SETUP_PROMPT_LIMIT in the frontend), which makes this the cost of actually using the extra
 * workspace rather than the cost of the empty row.
 */
export const EXTRA_PROJECT_CREDIT_RESERVE = EXTRA_PROMPT_CREDIT_RESERVE * 10

/**
 * A competitor triggers no extra scrape — it is matched against answers that were fetched
 * anyway — so it reserves one prompt's worth rather than a multiple, covering the added
 * analysis and storage without pricing it like new tracking.
 */
export const EXTRA_COMPETITOR_CREDIT_RESERVE = EXTRA_PROMPT_CREDIT_RESERVE

export const TRIAL_ENDED_REASON = "Your free trial has ended. Please upgrade or add credits to create new brand workspaces."
export const TRIAL_PROJECT_REASON = "Your Free Trial includes 1 Brand Workspace. Upgrade or add credits to manage multiple brands."
export const TRIAL_PROMPT_REASON = "Your free trial includes up to 10 prompts. Add a plan or credits to continue."

// A business rule rejected the request, so the caller must answer 400 with this message
// instead of hiding a legitimate product limit behind a generic 500. The status is carried
// on the error as well as implied by the type, so that the generic handlers which classify
// by the attached status treat a plan limit correctly without knowing this class exists.
export class PlanLimitError extends Error {
    readonly status = 400

    constructor(message: string) {
        super(message)
        this.name = "PlanLimitError"
    }
}

/**
 * The sentence shown when a paid plan is at its workspace cap. Built rather than declared
 * as a constant because the number and the plan name differ per plan, and the wording has
 * to name both for the user to know what upgrading would buy them.
 */
export function planLabel(plan: Plan) {
    return plan.charAt(0) + plan.slice(1).toLowerCase()
}

export function paidPlanProjectReason(plan: Plan, limit: number, requiredCredits?: number) {
    const workspaces = limit === 1 ? "1 brand workspace" : `${limit} brand workspaces`
    // Naming the credit figure matters: the account is not being told "no", it is being told
    // the price of "yes". Without the number the only visible route out is an upgrade, which
    // is the more expensive of the two options and often not the one they want.
    const route = requiredCredits === undefined
        ? "Upgrade to add more."
        : `Upgrade, or hold ${requiredCredits} credits to add more.`
    return `Your ${planLabel(plan)} plan includes ${workspaces}. ${route}`
}

export type ProjectLimitInput = {
    // The plan we report back to the client, which is the user's nominal plan and stays
    // FREE while a free product trial is running.
    plan: Plan
    // The plan that actually grants access right now; a free trial reports GROWTH here.
    effective_plan: Plan
    trial_active: boolean
    trial_expired: boolean
    credits_remaining: number
    project_count: number
    active_prompt_count: number
    requested_prompt_count: number
}

export type ProjectLimitVerdict = {
    allowed: boolean
    reason?: string
    plan: Plan
    project_count: number
    project_limit: number | "unlimited"
}

/**
 * Decides whether the user may create another brand workspace, together with the numbers
 * behind the decision. Enforcement throws on the verdict and the reporting endpoint
 * serialises it, so the two can never disagree.
 */
export function evaluateProjectLimit(input: ProjectLimitInput): ProjectLimitVerdict {
    const base = { plan: input.plan, project_count: input.project_count }

    // An expired trial is checked before anything else because a lapsed free user without
    // credits may not create a workspace at all, no matter how many they already have.
    if (input.trial_expired && input.effective_plan === "FREE" && input.credits_remaining <= 0) {
        return { ...base, project_limit: 0, allowed: false, reason: TRIAL_ENDED_REASON }
    }

    // The trial branch is deliberately evaluated before the plan, so a running trial caps
    // the account even when the effective plan would allow more.
    if (input.trial_active) {
        if (input.project_count >= TRIAL_PROJECT_LIMIT) {
            return { ...base, project_limit: TRIAL_PROJECT_LIMIT, allowed: false, reason: TRIAL_PROJECT_REASON }
        }
        if (input.active_prompt_count + input.requested_prompt_count > TRIAL_PROMPT_LIMIT) {
            return { ...base, project_limit: TRIAL_PROJECT_LIMIT, allowed: false, reason: TRIAL_PROMPT_REASON }
        }
        return { ...base, project_limit: TRIAL_PROJECT_LIMIT, allowed: true }
    }

    // Outside a trial the plan's own cap applies. This branch used to return "unlimited"
    // unconditionally, which meant the limits declared in plan_config were enforced against
    // nobody who paid: a STARTER subscriber with a declared cap of one workspace could create
    // any number of them. getProjectLimitForPlan already existed for this and had no caller
    // on the enforcement path. It also resolves /quota and /can/create-project disagreeing,
    // since /quota reported the declared limit while this reported "unlimited".
    const planLimit = getProjectLimitForPlan(input.effective_plan)
    if (planLimit !== "unlimited" && input.project_count >= planLimit) {
        // At the cap, credits are the way past it rather than the next tier up. The reserve is
        // required per workspace already taken beyond the allowance, so the second extra one
        // costs a second reserve — otherwise a single top-up would unlock an unbounded number.
        const beyondAllowance = input.project_count - planLimit + 1
        const required = beyondAllowance * EXTRA_PROJECT_CREDIT_RESERVE
        if (input.credits_remaining >= required) {
            return { ...base, project_limit: planLimit, allowed: true }
        }
        return {
            ...base,
            project_limit: planLimit,
            allowed: false,
            reason: paidPlanProjectReason(input.effective_plan, planLimit, required),
        }
    }

    return { ...base, project_limit: planLimit, allowed: true }
}

// ── Prompts and competitors ──────────────────────────────────────────────────

export type CapLimitInput = {
    plan: Plan
    effective_plan: Plan
    trial_active: boolean
    trial_expired: boolean
    credits_remaining: number
    used: number
    requested: number
}

export type CapLimitVerdict = {
    feature: SubscriptionLimitFeature
    allowed: boolean
    reason?: string
    plan: Plan
    used: number
    limit: number | "unlimited"
}

/**
 * The shared shape of every non-workspace cap: an expired trial with an empty wallet is
 * refused outright, a running trial is capped by the trial rules, and otherwise the plan's own
 * allowance applies with credits able to carry the account past it.
 *
 * It is one function rather than three because the three limits differed only in their numbers
 * and their wording, and keeping them apart is how `competitors` ended up enforced by nothing
 * at all while `projects` was enforced properly a few lines away.
 */
function evaluateCap(
    input: CapLimitInput,
    config: {
        feature: SubscriptionLimitFeature
        planLimit: number | "unlimited"
        trialLimit: number | null
        creditReserve: number
        trialReason: string
        endedReason: string
        paidReason: (plan: Plan, limit: number, requiredCredits: number) => string
    },
): CapLimitVerdict {
    const base = { feature: config.feature, plan: input.plan, used: input.used }
    const wanted = input.used + input.requested

    if (input.trial_expired && input.effective_plan === "FREE" && input.credits_remaining <= 0) {
        return { ...base, limit: 0, allowed: false, reason: config.endedReason }
    }

    if (input.trial_active && config.trialLimit !== null) {
        if (wanted > config.trialLimit) {
            return { ...base, limit: config.trialLimit, allowed: false, reason: config.trialReason }
        }
        return { ...base, limit: config.trialLimit, allowed: true }
    }

    if (config.planLimit === "unlimited" || wanted <= config.planLimit) {
        return { ...base, limit: config.planLimit, allowed: true }
    }

    const beyondAllowance = wanted - config.planLimit
    const required = beyondAllowance * config.creditReserve
    if (input.credits_remaining >= required) {
        return { ...base, limit: config.planLimit, allowed: true }
    }

    return {
        ...base,
        limit: config.planLimit,
        allowed: false,
        reason: config.paidReason(input.effective_plan, config.planLimit, required),
    }
}

export function evaluatePromptLimit(input: CapLimitInput): CapLimitVerdict {
    return evaluateCap(input, {
        feature: "prompt",
        planLimit: getPromptLimitForPlan(input.effective_plan),
        trialLimit: TRIAL_PROMPT_LIMIT,
        creditReserve: EXTRA_PROMPT_CREDIT_RESERVE,
        trialReason: TRIAL_PROMPT_REASON,
        endedReason: "Your free trial has ended. Please upgrade or add credits to add more prompts.",
        paidReason: (plan, limit, required) =>
            `Your ${planLabel(plan)} plan includes ${limit} prompts. Upgrade, or hold ${required} credits to track more.`,
    })
}

export function evaluateCompetitorLimit(input: CapLimitInput): CapLimitVerdict {
    return evaluateCap(input, {
        feature: "competitor",
        planLimit: PLAN_LIMITS[input.effective_plan]?.competitors ?? PLAN_LIMITS.FREE.competitors,
        // A trial reports the GROWTH competitor allowance and there is no separate trial
        // number, so the plan branch handles it.
        trialLimit: null,
        creditReserve: EXTRA_COMPETITOR_CREDIT_RESERVE,
        trialReason: "",
        endedReason: "Your free trial has ended. Please upgrade or add credits to track more competitors.",
        paidReason: (plan, limit, required) =>
            `Your ${planLabel(plan)} plan includes ${limit} competitors. Upgrade, or hold ${required} credits to track more.`,
    })
}

export function toCapLimitCheck(verdict: CapLimitVerdict): LimitCheckResponse {
    return {
        feature: verdict.feature,
        plan: verdict.plan,
        limit: verdict.limit,
        used: verdict.used,
        allowed: verdict.allowed,
        reason: verdict.reason,
    }
}

/**
 * Serialises a verdict into the shape the `can/create-project` endpoint has always
 * returned. The mapping lives next to the rules so that the reported numbers cannot drift
 * away from the ones the decision was made with.
 */
export function toProjectLimitCheck(verdict: ProjectLimitVerdict): LimitCheckResponse {
    return {
        feature: "project",
        plan: verdict.plan,
        limit: verdict.project_limit,
        used: verdict.project_count,
        allowed: verdict.allowed,
        reason: verdict.reason,
    }
}
