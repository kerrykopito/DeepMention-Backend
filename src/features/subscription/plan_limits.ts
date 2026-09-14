import type { Plan } from "@prisma/client"
import { getProjectLimitForPlan } from "./plan_config"
import type { LimitCheckResponse } from "./subscription_types"

// This module is the single source of truth for the brand-workspace limit, and it is kept
// free of runtime imports (prisma, Stripe) so that both the enforcement path and the
// reporting endpoint — and a plain `tsx` test — can use the same rules.

export const TRIAL_PROJECT_LIMIT = 1
export const TRIAL_PROMPT_LIMIT = 10

export const TRIAL_ENDED_REASON = "Your free trial has ended. Please upgrade or add credits to create new brand workspaces."
export const TRIAL_PROJECT_REASON = "Your Free Trial includes 1 Brand Workspace. Upgrade or add credits to manage multiple brands."
export const TRIAL_PROMPT_REASON = "Your free trial includes up to 10 prompts. Add a plan or credits to continue."

// A business rule rejected the request, so the caller must answer 400 with this message
// instead of hiding a legitimate product limit behind a generic 500.
export class PlanLimitError extends Error {
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
export function paidPlanProjectReason(plan: Plan, limit: number) {
    const label = plan.charAt(0) + plan.slice(1).toLowerCase()
    const workspaces = limit === 1 ? "1 brand workspace" : `${limit} brand workspaces`
    return `Your ${label} plan includes ${workspaces}. Upgrade to add more.`
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
        return {
            ...base,
            project_limit: planLimit,
            allowed: false,
            reason: paidPlanProjectReason(input.effective_plan, planLimit),
        }
    }

    return { ...base, project_limit: planLimit, allowed: true }
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
