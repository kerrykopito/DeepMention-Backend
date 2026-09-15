import assert from "node:assert/strict"
import {
    RESOURCE_NOT_FOUND_MESSAGES,
    getErrorCode,
    getErrorStatus,
    httpError,
    isDatabaseUnreachable,
    resolveErrorResponse,
} from "./http_error"
import { PlanLimitError } from "../features/subscription/plan_limits"
import { EMAIL_DELIVERY_FAILED } from "../features/email/email_service"

// The errors below are rebuilt exactly as the services now throw them rather than imported
// from those services, because every one of them sits in a module that instantiates a Prisma
// client the moment it is loaded. plan_limits.ts is import-free for the same reason, and
// EMAIL_NOT_VERIFIED is spelled out here only because auth_service is not.
const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED"

// A failure nobody anticipated. Every call site must answer 500 with its own sentence and
// keep this text to the logs, which is the half of the old behaviour worth preserving.
const unexpected = new Error("connect ECONNREFUSED 127.0.0.1:5432")

// ─── The primitives ───────────────────────────────────────────────────────────

assert.equal(getErrorStatus(httpError(409, "taken")), 409)
assert.equal(getErrorStatus(new Error("boom")), null)
// A status outside the range a response can carry is not a classification.
assert.equal(getErrorStatus(Object.assign(new Error("x"), { status: 200 })), null)
assert.equal(getErrorStatus(Object.assign(new Error("x"), { status: "400" })), 400)
assert.equal(getErrorStatus(undefined), null)
assert.equal(getErrorCode(httpError(502, "down", "MAIL_DOWN")), "MAIL_DOWN")
assert.equal(getErrorCode(new Error("boom")), null)

// A message that happens to name something on Object.prototype must not be mistaken for a
// known resource code, which is why the not-found table is a Map.
assert.equal(RESOURCE_NOT_FOUND_MESSAGES.get("constructor"), undefined)
assert.equal(resolveErrorResponse(new Error("constructor"), "Failed").status, 500)

// ─── onboarding_controller: POST /onboarding/project ──────────────────────────

// The workspace limit that started all of this: a real sentence, answered 400.
const workspaceLimit = resolveErrorResponse(
    new PlanLimitError("Your Free Trial includes 1 Brand Workspace. Upgrade or add credits to manage multiple brands."),
    "Failed to create project",
)
assert.equal(workspaceLimit.status, 400)
assert.equal(workspaceLimit.message, "Your Free Trial includes 1 Brand Workspace. Upgrade or add credits to manage multiple brands.")
assert.equal(workspaceLimit.unexpected, false)

// The two validation rejections the controller used to recognise by their wording.
assert.deepEqual(
    resolveErrorResponse(httpError(400, "Select at least one prompt for your first visibility run"), "Failed to create project"),
    { status: 400, message: "Select at least one prompt for your first visibility run", unexpected: false },
)
assert.deepEqual(
    resolveErrorResponse(httpError(400, "Please select a supported primary market"), "Failed to create project"),
    { status: 400, message: "Please select a supported primary market", unexpected: false },
)

// 'User not found' stays a 500 here, as it has always been on this route: retiring the
// substring list was not licence to restate what the other rejections answer.
assert.deepEqual(
    resolveErrorResponse(new Error("User not found"), "Failed to create project"),
    { status: 500, message: "Failed to create project", unexpected: true },
)

const onboardingFault = resolveErrorResponse(unexpected, "Failed to create project")
assert.equal(onboardingFault.status, 500)
assert.equal(onboardingFault.message, "Failed to create project")
assert.equal(onboardingFault.unexpected, true)
// The internal text never reaches the client on a genuine fault.
assert.equal(onboardingFault.message.includes("ECONNREFUSED"), false)

// ─── project_engines_controller: PUT /projects/:id/engines ────────────────────

const emptySelection = resolveErrorResponse(httpError(400, "Select at least one AI engine."), "Failed to update AI engines")
assert.equal(emptySelection.status, 400)
assert.equal(emptySelection.message, "Select at least one AI engine.")

const trialEngineCap = new PlanLimitError("Your free trial includes 3 AI engines. Add a plan or credits to unlock all engines.")
assert.deepEqual(
    resolveErrorResponse(trialEngineCap, "Failed to update AI engines"),
    { status: 400, message: "Your free trial includes 3 AI engines. Add a plan or credits to unlock all engines.", unexpected: false },
)

// A client viewer's read-only rejection: a 403 whose sentence contains neither "Select" nor
// "plan", so the old test dropped it into the 500 branch and told the user the server broke.
assert.deepEqual(
    resolveErrorResponse(
        httpError(403, "Read-only access: Client viewers cannot modify projects or prompts."),
        "Failed to update AI engines",
    ),
    { status: 403, message: "Read-only access: Client viewers cannot modify projects or prompts.", unexpected: false },
)

assert.deepEqual(
    resolveErrorResponse(unexpected, "Failed to update AI engines"),
    { status: 500, message: "Failed to update AI engines", unexpected: true },
)

// ─── prompt_controller: create and activate ───────────────────────────────────

// This is the rejection the old predicate missed. The sentence contains no "plan", so a user
// whose trial had ended was told "Failed to create prompt" with a 500.
const trialEnded = new PlanLimitError("Your free trial has ended. Please upgrade or add credits to add more prompts.")
assert.deepEqual(
    resolveErrorResponse(trialEnded, "Failed to create prompt"),
    { status: 400, message: "Your free trial has ended. Please upgrade or add credits to add more prompts.", unexpected: false },
)
assert.deepEqual(
    resolveErrorResponse(trialEnded, "Failed to activate prompt"),
    { status: 400, message: "Your free trial has ended. Please upgrade or add credits to add more prompts.", unexpected: false },
)

// The ten-prompt cap, which the word "plan" happened to catch before and which must keep
// answering exactly as it did.
assert.deepEqual(
    resolveErrorResponse(
        new PlanLimitError("Your free trial includes up to 10 prompts. Add a plan or credits to continue."),
        "Failed to create prompt",
    ),
    { status: 400, message: "Your free trial includes up to 10 prompts. Add a plan or credits to continue.", unexpected: false },
)

// project_access throws a machine code, not a sentence. It must never be echoed to a client
// as though it were a message, even though the code carries a 404 of its own.
assert.deepEqual(
    resolveErrorResponse(new Error("PROJECT_NOT_FOUND"), "Failed to create prompt"),
    { status: 404, message: "Project not found", unexpected: false },
)
assert.deepEqual(
    resolveErrorResponse(Object.assign(new Error("PROMPT_NOT_FOUND"), { status: 404, code: "prompt_not_found" }), "Failed to activate prompt"),
    { status: 404, message: "Prompt not found", unexpected: false },
)

assert.deepEqual(
    resolveErrorResponse(unexpected, "Failed to create prompt"),
    { status: 500, message: "Failed to create prompt", unexpected: true },
)
assert.deepEqual(
    resolveErrorResponse(unexpected, "Failed to activate prompt"),
    { status: 500, message: "Failed to activate prompt", unexpected: true },
)

// ─── scraping_controller: POST /scrape/run ────────────────────────────────────

assert.deepEqual(
    resolveErrorResponse(trialEngineCap, "Failed to enqueue scrape run"),
    { status: 400, message: "Your free trial includes 3 AI engines. Add a plan or credits to unlock all engines.", unexpected: false },
)
assert.deepEqual(
    resolveErrorResponse(new Error("PROJECT_NOT_FOUND"), "Failed to enqueue scrape run"),
    { status: 404, message: "Project not found", unexpected: false },
)
assert.deepEqual(
    resolveErrorResponse(unexpected, "Failed to enqueue scrape run"),
    { status: 500, message: "Failed to enqueue scrape run", unexpected: true },
)

// ─── auth_controller: POST /auth/register ─────────────────────────────────────

const registerFallback = "Registration failed. Please try again."
assert.deepEqual(
    resolveErrorResponse(httpError(409, "An account with this email already exists."), registerFallback),
    { status: 409, message: "An account with this email already exists.", unexpected: false },
)
assert.deepEqual(
    resolveErrorResponse(httpError(422, "Only work/business email addresses are allowed."), registerFallback),
    { status: 422, message: "Only work/business email addresses are allowed.", unexpected: false },
)
assert.deepEqual(
    resolveErrorResponse(unexpected, registerFallback),
    { status: 500, message: registerFallback, unexpected: true },
)

// The mail provider's failure is picked out by its code before the resolver is consulted,
// because the raw provider text must not be shown to anybody.
const brevoDown = httpError(502, "Brevo email send failed (400): sender not authorised", EMAIL_DELIVERY_FAILED)
assert.equal(getErrorCode(brevoDown), EMAIL_DELIVERY_FAILED)
assert.equal(getErrorCode(unexpected) === EMAIL_DELIVERY_FAILED, false)
assert.equal(getErrorStatus(brevoDown), 502)
// And if that branch is ever reordered or removed, the provider's text still does not reach
// the client: the resolver releases a message only for a 4xx, and treats a 5xx as the server
// fault it is. This is the one guarantee that holds without the call sites cooperating.
const brevoThroughResolver = resolveErrorResponse(brevoDown, registerFallback)
assert.deepEqual(brevoThroughResolver, { status: 500, message: registerFallback, unexpected: true })
assert.equal(brevoThroughResolver.message.includes("Brevo"), false)
assert.equal(brevoThroughResolver.message.includes("sender not authorised"), false)

// ─── auth_controller: POST /auth/login ────────────────────────────────────────

// Only the unverified account earns a 403; it is now recognised by its code.
const notVerified = httpError(403, "please verify your email", EMAIL_NOT_VERIFIED)
assert.equal(getErrorCode(notVerified), EMAIL_NOT_VERIFIED)
// The thrown wording is unchanged, because the controller's EXPECTED_AUTH_ERRORS set matches
// it literally on the 401 path.
assert.equal(notVerified.message, "please verify your email")

// The credential failure must stay vague and must not be promoted out of its 401 by carrying
// a code of its own: nothing about it may reveal whether the account exists.
const wrongCredentials = new Error("email or password is incorrect")
assert.equal(getErrorCode(wrongCredentials), null)
assert.equal(getErrorStatus(wrongCredentials), null)
assert.equal(getErrorCode(wrongCredentials) === EMAIL_NOT_VERIFIED, false)

// An unreachable database is not a rejected password. Prisma's own code identifies it,
// with the message check behind that for the adapter surfacing it untyped.
assert.equal(isDatabaseUnreachable(Object.assign(new Error("boom"), { errorCode: "P1001" })), true)
assert.equal(isDatabaseUnreachable(Object.assign(new Error("boom"), { code: "P1001" })), true)
assert.equal(isDatabaseUnreachable(Object.assign(new Error("init failed"), { name: "PrismaClientInitializationError" })), true)
assert.equal(isDatabaseUnreachable(new Error("Can't reach database server at `db:5432`")), true)
assert.equal(isDatabaseUnreachable(wrongCredentials), false)
assert.equal(isDatabaseUnreachable(notVerified), false)

// ─── settings_controller: PATCH /settings/account-type ────────────────────────

assert.deepEqual(
    resolveErrorResponse(httpError(404, "User not found"), "Failed to update account type"),
    { status: 404, message: "User not found", unexpected: false },
)
assert.deepEqual(
    resolveErrorResponse(
        httpError(409, "Agency accounts cannot be converted to individual accounts while shared workspace data exists"),
        "Failed to update account type",
    ),
    { status: 409, message: "Agency accounts cannot be converted to individual accounts while shared workspace data exists", unexpected: false },
)
assert.deepEqual(
    resolveErrorResponse(
        httpError(409, "Cancel the active individual subscription before converting to an agency account"),
        "Failed to update account type",
    ),
    { status: 409, message: "Cancel the active individual subscription before converting to an agency account", unexpected: false },
)
assert.deepEqual(
    resolveErrorResponse(unexpected, "Failed to update account type"),
    { status: 500, message: "Failed to update account type", unexpected: true },
)

// ─── subscription_controller: billing portal and Stripe webhook ───────────────

assert.deepEqual(
    resolveErrorResponse(httpError(400, "No Stripe billing account found"), "Failed to open billing portal", { fallbackStatus: 400 }),
    { status: 400, message: "No Stripe billing account found", unexpected: false },
)
// This route has always answered 400 rather than 500 to an unrecognised failure, and still
// does - but it still refuses to show the internal text.
const portalFault = resolveErrorResponse(unexpected, "Failed to open billing portal", { fallbackStatus: 400 })
assert.deepEqual(portalFault, { status: 400, message: "Failed to open billing portal", unexpected: true })

// The webhook answers 400 only to a verification failure, which is tagged where it is raised.
assert.equal(getErrorStatus(httpError(400, "No signatures found matching the expected signature for payload.")) === 400, true)
assert.equal(getErrorStatus(httpError(400, "Missing Stripe signature")) === 400, true)
// A failure while processing the event is untagged, so Stripe is told to retry rather than
// being told its signature was bad - even when the message happens to mention one.
assert.equal(getErrorStatus(new Error("column signature_id does not exist")), null)

// ─── The predicates that used to decide this, on the messages that broke them ─

// prompt_controller checked for "plan" or "remaining".
const oldPromptPredicate = (message: string) => message.includes("plan") || message.includes("remaining")
assert.equal(oldPromptPredicate("Your free trial has ended. Please upgrade or add credits to add more prompts."), false)
assert.equal(oldPromptPredicate("Read-only access: Client viewers cannot modify projects or prompts."), false)
// "remaining" matched nothing either service has ever thrown; it was dead weight.
assert.equal(oldPromptPredicate("Your free trial includes up to 10 prompts. Add a plan or credits to continue."), true)

// scraping_controller checked for "Select at least" or "plan can track".
const oldScrapePredicate = (message: string) => message.includes("Select at least") || message.includes("plan can track")
assert.equal(oldScrapePredicate("Your free trial includes 3 AI engines. Add a plan or credits to unlock all engines."), false)

// project_engines_controller checked for "Select" or "plan".
const oldEnginePredicate = (message: string) => message.includes("Select") || message.includes("plan")
assert.equal(oldEnginePredicate("Read-only access: Client viewers cannot modify projects or prompts."), false)

console.log("Error classification checks passed.")
