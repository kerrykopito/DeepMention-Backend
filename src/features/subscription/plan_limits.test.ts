import assert from "node:assert/strict"
import {
    PlanLimitError,
    TRIAL_ENDED_REASON,
    TRIAL_PROJECT_REASON,
    TRIAL_PROMPT_REASON,
    evaluateProjectLimit,
    EXTRA_COMPETITOR_CREDIT_RESERVE,
    EXTRA_PROJECT_CREDIT_RESERVE,
    EXTRA_PROMPT_CREDIT_RESERVE,
    evaluateCompetitorLimit,
    evaluatePromptLimit,
    paidPlanProjectReason,
    toCapLimitCheck,
    type CapLimitInput,
    toProjectLimitCheck,
    type ProjectLimitInput,
} from "./plan_limits"

// A user on the running free product trial: the plan is FREE, the access is GROWTH.
function trialUser(overrides: Partial<ProjectLimitInput> = {}): ProjectLimitInput {
    return {
        plan: "FREE",
        effective_plan: "GROWTH",
        trial_active: true,
        trial_expired: false,
        credits_remaining: 0,
        project_count: 0,
        active_prompt_count: 0,
        requested_prompt_count: 1,
        ...overrides,
    }
}

// Allowed: the trial is running and the first workspace has not been created yet.
const firstWorkspace = evaluateProjectLimit(trialUser())
assert.equal(firstWorkspace.allowed, true)
assert.equal(firstWorkspace.reason, undefined)
assert.equal(firstWorkspace.project_limit, 1)
assert.equal(firstWorkspace.project_count, 0)

// Blocked 1: the trial ended, the plan fell back to FREE and no credits are left.
const expiredTrial = evaluateProjectLimit(trialUser({
    plan: "FREE",
    effective_plan: "FREE",
    trial_active: false,
    trial_expired: true,
    credits_remaining: 0,
    project_count: 2,
}))
assert.equal(expiredTrial.allowed, false)
assert.equal(expiredTrial.reason, TRIAL_ENDED_REASON)
assert.equal(expiredTrial.project_limit, 0)

// Credits bought after the trial ended unblock creation again.
assert.equal(evaluateProjectLimit(trialUser({
    effective_plan: "FREE",
    trial_active: false,
    trial_expired: true,
    credits_remaining: 500,
})).allowed, true)

// Blocked 2: the trial allows exactly one brand workspace.
const secondWorkspace = evaluateProjectLimit(trialUser({ project_count: 1 }))
assert.equal(secondWorkspace.allowed, false)
assert.equal(secondWorkspace.reason, TRIAL_PROJECT_REASON)
assert.equal(secondWorkspace.project_limit, 1)
assert.equal(secondWorkspace.project_count, 1)

// Blocked 3: the trial allows up to ten active prompts across the account.
const tooManyPrompts = evaluateProjectLimit(trialUser({ active_prompt_count: 8, requested_prompt_count: 3 }))
assert.equal(tooManyPrompts.allowed, false)
assert.equal(tooManyPrompts.reason, TRIAL_PROMPT_REASON)
// Exactly ten prompts is still within the trial.
assert.equal(evaluateProjectLimit(trialUser({ active_prompt_count: 8, requested_prompt_count: 2 })).allowed, true)

// The expired trial is evaluated before the workspace count, so a lapsed user who has no
// workspaces at all is told the trial ended rather than being let through.
assert.equal(evaluateProjectLimit(trialUser({
    effective_plan: "FREE",
    trial_active: false,
    trial_expired: true,
    project_count: 0,
})).reason, TRIAL_ENDED_REASON)

// A paid plan outside a trial is capped by what the plan declares. GROWTH declares two
// workspaces, so a subscriber sitting on four is over the cap and is refused. This assertion
// used to expect allowed with limit "unlimited", which described enforcement accurately at
// the time and was itself the bug: the declared caps applied to nobody who paid.
const overCap = evaluateProjectLimit(trialUser({
    plan: "GROWTH",
    effective_plan: "GROWTH",
    trial_active: false,
    trial_expired: false,
    project_count: 4,
}))
assert.equal(overCap.allowed, false)
assert.equal(overCap.project_limit, 2)

// The reporting endpoint serialises the same verdict, so GET /api/subscription/can/create-project
// stops answering "unlimited, 0 used, allowed" to a trial user who already has a workspace.
const reported = toProjectLimitCheck(evaluateProjectLimit(trialUser({ project_count: 1, requested_prompt_count: 0 })))
assert.deepEqual(reported, {
    feature: "project",
    plan: "FREE",
    limit: 1,
    used: 1,
    allowed: false,
    reason: "Your Free Trial includes 1 Brand Workspace. Upgrade or add credits to manage multiple brands.",
})

// An allowed report carries no reason, because a reason is only set when something blocks.
assert.equal(toProjectLimitCheck(evaluateProjectLimit(trialUser())).reason, undefined)

// The controller must recognise a business rule by its type: the real sentence reaches the
// user as a 400 instead of being swallowed by the generic "Failed to create project".
const planLimitError = new PlanLimitError(secondWorkspace.reason!)
assert.equal(planLimitError instanceof PlanLimitError, true)
assert.equal(planLimitError instanceof Error, true)
assert.equal(planLimitError.message, TRIAL_PROJECT_REASON)
assert.equal(new Error("boom") instanceof PlanLimitError, false)

// This is why the bug existed: the old substring test matched none of the workspace
// sentence, so a legitimate rejection was reported as a server error.
const oldSubstringMatch = (message: string) =>
    message.includes("plan") || message.includes("Missing required") || message.includes("supported primary market") || message.includes("Select at least")
assert.equal(oldSubstringMatch(TRIAL_PROJECT_REASON), false)
assert.equal(oldSubstringMatch(TRIAL_ENDED_REASON), false)

// A paying subscriber: no product trial is running, so the plan's own cap governs.
function paidUser(overrides: Partial<ProjectLimitInput> = {}): ProjectLimitInput {
    return {
        plan: "STARTER",
        effective_plan: "STARTER",
        trial_active: false,
        trial_expired: false,
        credits_remaining: 100,
        project_count: 0,
        active_prompt_count: 0,
        requested_prompt_count: 1,
        ...overrides,
    }
}

// Blocked 4: STARTER declares one workspace, and the subscriber already has it. Before the
// cap was enforced this returned allowed with limit "unlimited", so a paying customer could
// create any number of workspaces regardless of what they were sold.
const starterAtCap = evaluateProjectLimit(paidUser({ project_count: 1 }))
assert.equal(starterAtCap.allowed, false)
assert.equal(starterAtCap.project_limit, 1)
assert.equal(starterAtCap.reason, paidPlanProjectReason("STARTER", 1, EXTRA_PROJECT_CREDIT_RESERVE))
assert.equal(starterAtCap.reason?.includes("1 brand workspace"), true)

// Allowed: the same plan with no workspace yet.
const starterFirst = evaluateProjectLimit(paidUser({ project_count: 0 }))
assert.equal(starterFirst.allowed, true)
assert.equal(starterFirst.project_limit, 1)
assert.equal(starterFirst.reason, undefined)

// GROWTH declares two, so one workspace still leaves room and two does not.
const growthWithRoom = evaluateProjectLimit(paidUser({ plan: "GROWTH", effective_plan: "GROWTH", project_count: 1 }))
assert.equal(growthWithRoom.allowed, true)
assert.equal(growthWithRoom.project_limit, 2)

const growthAtCap = evaluateProjectLimit(paidUser({ plan: "GROWTH", effective_plan: "GROWTH", project_count: 2 }))
assert.equal(growthAtCap.allowed, false)
assert.equal(growthAtCap.reason?.includes("2 brand workspaces"), true)

// PRO declares five.
const proWithRoom = evaluateProjectLimit(paidUser({ plan: "PRO", effective_plan: "PRO", project_count: 4 }))
assert.equal(proWithRoom.allowed, true)
assert.equal(proWithRoom.project_limit, 5)

// The reported numbers must be the ones the decision used, not a second lookup.
const paidCheck = toProjectLimitCheck(starterAtCap)
assert.equal(paidCheck.allowed, false)
assert.equal(paidCheck.limit, 1)
assert.equal(paidCheck.used, 1)
assert.equal(paidCheck.plan, "STARTER")

// The paid sentence happens to contain the word "plan", so the old predicate would have
// classified it correctly by luck - which is exactly the fragility being removed here. What
// matters is that classification no longer depends on the wording at all: every rejection
// travels as a PlanLimitError, so rephrasing any of these sentences cannot turn a 400 into
// a 500 again.
assert.equal(oldSubstringMatch(paidPlanProjectReason("STARTER", 1)), true)
assert.equal(new PlanLimitError(paidPlanProjectReason("STARTER", 1)) instanceof PlanLimitError, true)
assert.equal(new PlanLimitError(TRIAL_PROJECT_REASON) instanceof PlanLimitError, true)

// ── Credits as extra capacity ────────────────────────────────────────────────

// A subscriber at the workspace cap gets past it by holding the reserve. Below it they are
// still refused, so a token top-up cannot unlock an unbounded number of workspaces.
assert.equal(evaluateProjectLimit(paidUser({
    project_count: 1,
    credits_remaining: EXTRA_PROJECT_CREDIT_RESERVE,
})).allowed, true)
assert.equal(evaluateProjectLimit(paidUser({
    project_count: 1,
    credits_remaining: EXTRA_PROJECT_CREDIT_RESERVE - 1,
})).allowed, false)

// The reserve is per workspace taken beyond the allowance, so the second extra one costs a
// second reserve rather than riding along on the first purchase.
assert.equal(evaluateProjectLimit(paidUser({
    project_count: 2,
    credits_remaining: EXTRA_PROJECT_CREDIT_RESERVE,
})).allowed, false)
assert.equal(evaluateProjectLimit(paidUser({
    project_count: 2,
    credits_remaining: EXTRA_PROJECT_CREDIT_RESERVE * 2,
})).allowed, true)

// The rejection names the price of "yes", not just the fact of "no".
const overCapReason = evaluateProjectLimit(paidUser({ project_count: 1 })).reason ?? ""
assert.equal(overCapReason.includes(String(EXTRA_PROJECT_CREDIT_RESERVE)), true)
assert.equal(overCapReason.includes("credits"), true)

// ── Prompts ──────────────────────────────────────────────────────────────────

function promptUser(overrides: Partial<CapLimitInput> = {}): CapLimitInput {
    return {
        plan: "STARTER",
        effective_plan: "STARTER",
        trial_active: false,
        trial_expired: false,
        credits_remaining: 0,
        used: 0,
        requested: 1,
        ...overrides,
    }
}

// STARTER declares 15 prompts. Before this was wired, getPromptLimitForPlan had no caller at
// all and a STARTER subscriber could create any number.
assert.equal(evaluatePromptLimit(promptUser({ used: 14 })).allowed, true)
assert.equal(evaluatePromptLimit(promptUser({ used: 15 })).allowed, false)
assert.equal(evaluatePromptLimit(promptUser({ used: 15 })).limit, 15)

// Credits carry the account past the prompt cap, one reserve per prompt over it.
assert.equal(evaluatePromptLimit(promptUser({
    used: 15,
    credits_remaining: EXTRA_PROMPT_CREDIT_RESERVE,
})).allowed, true)
assert.equal(evaluatePromptLimit(promptUser({
    used: 15,
    requested: 2,
    credits_remaining: EXTRA_PROMPT_CREDIT_RESERVE,
})).allowed, false)
assert.equal(evaluatePromptLimit(promptUser({
    used: 15,
    requested: 2,
    credits_remaining: EXTRA_PROMPT_CREDIT_RESERVE * 2,
})).allowed, true)

// A running trial is capped by the trial rule, not the plan it has access to: the trial grants
// GROWTH access, which declares 30 prompts, and the trial allows 10.
assert.equal(evaluatePromptLimit(promptUser({
    plan: "FREE",
    effective_plan: "GROWTH",
    trial_active: true,
    used: 10,
})).allowed, false)
assert.equal(evaluatePromptLimit(promptUser({
    plan: "FREE",
    effective_plan: "GROWTH",
    trial_active: true,
    used: 9,
})).allowed, true)
assert.equal(evaluatePromptLimit(promptUser({
    plan: "FREE",
    effective_plan: "GROWTH",
    trial_active: true,
    used: 10,
})).reason, TRIAL_PROMPT_REASON)

// An expired trial with an empty wallet is refused before any allowance is considered.
assert.equal(evaluatePromptLimit(promptUser({
    plan: "FREE",
    effective_plan: "FREE",
    trial_expired: true,
    used: 0,
})).allowed, false)

// ── Competitors ──────────────────────────────────────────────────────────────

// STARTER declares 3. assertCanAddCompetitors used to return allowed unconditionally, so this
// number applied to nobody.
assert.equal(evaluateCompetitorLimit(promptUser({ used: 2 })).allowed, true)
assert.equal(evaluateCompetitorLimit(promptUser({ used: 3 })).allowed, false)
assert.equal(evaluateCompetitorLimit(promptUser({ used: 3 })).limit, 3)
assert.equal(evaluateCompetitorLimit(promptUser({
    used: 3,
    credits_remaining: EXTRA_COMPETITOR_CREDIT_RESERVE,
})).allowed, true)

// Adding several at once is judged on the total, not one at a time — onboarding submits a
// whole competitor list in a single call.
assert.equal(evaluateCompetitorLimit(promptUser({ used: 0, requested: 3 })).allowed, true)
assert.equal(evaluateCompetitorLimit(promptUser({ used: 0, requested: 4 })).allowed, false)

// Reported numbers come from the verdict that was reached, never a second lookup.
const promptCheck = toCapLimitCheck(evaluatePromptLimit(promptUser({ used: 15 })))
assert.equal(promptCheck.feature, "prompt")
assert.equal(promptCheck.allowed, false)
assert.equal(promptCheck.limit, 15)
assert.equal(promptCheck.used, 15)

// Every rejection here is a PlanLimitError too, so none of them can regress into a 500 by
// being reworded.
assert.equal(new PlanLimitError(promptCheck.reason ?? "") instanceof PlanLimitError, true)

console.log("Brand workspace limit checks passed.")
console.log("Prompt, competitor and credit-extension checks passed.")
