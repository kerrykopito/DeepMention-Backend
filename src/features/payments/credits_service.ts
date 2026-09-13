/**
 * credits_service.ts
 * Core credits engine: check balance, deduct, award, and fetch history.
 */

import type Stripe from "stripe"
import prisma from "../../lib/prisma"
import { AccountType, Plan, Prisma, SubscriptionStatus } from "@prisma/client"
import { CREDIT_ACTIONS, LOW_BALANCE_THRESHOLD, creditPolicyFor, signupBonusFor, getCreditPack, getCustomCreditPack, type CreditAction } from "./credits_config"
import { getBillingPlan, type PaidPlan } from "./billing_catalog"
import { getStripeClient } from "../subscription/stripe_config"

export async function getBillingAccountContext(userId: string): Promise<{ billingUserId: string; accountType: AccountType }> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { account_type: true } })
    if (user?.account_type === AccountType.AGENCY) return { billingUserId: userId, accountType: AccountType.AGENCY }
    const membership = await prisma.agencyMembership.findFirst({ where: { member_user_id: userId, status: "ACTIVE" }, select: { agency_user_id: true } })
    const clientLink = membership ? null : await prisma.agencyClientLink.findFirst({ where: { client_user_id: userId, status: "ACTIVE" }, select: { agency_user_id: true } })
    const billingUserId = membership?.agency_user_id ?? clientLink?.agency_user_id ?? userId
    if (billingUserId === userId) return { billingUserId, accountType: user?.account_type ?? AccountType.SINGLE }
    const owner = await prisma.user.findUnique({ where: { id: billingUserId }, select: { account_type: true } })
    return { billingUserId, accountType: owner?.account_type ?? AccountType.AGENCY }
}

export async function resolveBillingUserId(userId: string): Promise<string> {
    return (await getBillingAccountContext(userId)).billingUserId
}

export async function getPromptRunCreditCost(userId: string): Promise<number> {
    const { accountType } = await getBillingAccountContext(userId)
    return creditPolicyFor(accountType).prompt_run
}

export async function getSiteAuditCreditCost(userId: string, maxPages: number): Promise<number> {
    const { accountType } = await getBillingAccountContext(userId)
    const rates = creditPolicyFor(accountType).site_audit
    if (maxPages <= 25) return rates.quick
    if (maxPages <= 100) return rates.standard
    return rates.deep
}

async function getActionCreditCost(userId: string, action: CreditAction): Promise<number> {
    return action === "PROMPT_RUN" ? getPromptRunCreditCost(userId) : CREDIT_ACTIONS[action]
}

export async function expireCreditBuckets(userId: string) {
    const now = new Date()
    const expired = await prisma.creditBucket.findMany({ where: { user_id: userId, amount_remaining: { gt: 0 }, expires_at: { lte: now } }, select: { id: true, amount_remaining: true, source: true } })
    if (!expired.length) return 0
    const amount = expired.reduce((sum, bucket) => sum + bucket.amount_remaining, 0)
    await prisma.$transaction(async tx => {
        await tx.creditBucket.updateMany({ where: { id: { in: expired.map(bucket => bucket.id) } }, data: { amount_remaining: 0 } })
        await tx.user.update({ where: { id: userId }, data: { credits_balance: { decrement: amount } } })
        await tx.creditTransaction.create({ data: { user_id: userId, amount: -amount, action: "CREDIT_EXPIRY", description: `${expired.map(bucket => bucket.source).join(", ")} credits expired`, metadata: { expired_at: now.toISOString() } } })
    })
    return amount
}

export async function createCreditBucket(userId: string, amount: number, source: string, expiresAt: Date | null = null) {
    if (amount <= 0) return
    await prisma.creditBucket.create({ data: { user_id: userId, amount_remaining: amount, source, expires_at: expiresAt } })
}

export class InsufficientCreditsError extends Error {
    constructor(required: number, available: number) {
        super(`Insufficient credits: need ${required}, have ${available}`)
        this.name = "InsufficientCreditsError"
    }
}

/**
 * Get the current credit balance for a user.
 */
export async function getCreditBalance(userId: string): Promise<number> {
    const billingUserId = await resolveBillingUserId(userId)
    await expireCreditBuckets(billingUserId)
    const user = await prisma.user.findUnique({
        where:  { id: billingUserId },
        select: { credits_balance: true },
    })
    return user?.credits_balance ?? 0
}

/**
 * Assert that the user has enough credits for an action.
 * Throws InsufficientCreditsError if not.
 */
export async function assertCredits(userId: string, action: CreditAction): Promise<void> {
    const cost    = await getActionCreditCost(userId, action)
    const balance = await getCreditBalance(userId)
    if (balance < cost) throw new InsufficientCreditsError(cost, balance)
}

/**
 * Deduct credits for an action in a single atomic transaction.
 * Returns the new balance.
 */
export async function deductCredits(
    userId:      string,
    action:      CreditAction,
    description?: string,
    metadata?:   Record<string, unknown>,
): Promise<number> {
    const cost    = await getActionCreditCost(userId, action)
    const billingUserId = await resolveBillingUserId(userId)
    const balance = await getCreditBalance(billingUserId)

    if (balance < cost) throw new InsufficientCreditsError(cost, balance)

    const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
            where: { id: billingUserId },
            data:  { credits_balance: { decrement: cost } },
            select: { credits_balance: true },
        }),
        prisma.creditTransaction.create({
            data: {
                user_id:     billingUserId,
                amount:      -cost,
                action,
                description: description ?? action,
                metadata:    metadata ? (metadata as any) : undefined,
            },
        }),
    ])

    return updatedUser.credits_balance
}

/**
 * Add credits to the user's wallet (e.g., after a Razorpay top-up or signup bonus).
 * Returns the new balance.
 */
export async function awardCredits(
    userId:      string,
    amount:      number,
    action:      string,
    description?: string,
    metadata?:   Record<string, unknown>,
): Promise<number> {
    const billingUserId = await resolveBillingUserId(userId)
    await expireCreditBuckets(billingUserId)
    const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
            where: { id: billingUserId },
            data:  { credits_balance: { increment: amount } },
            select: { credits_balance: true },
        }),
        prisma.creditTransaction.create({
            data: {
                user_id:     billingUserId,
                amount:      +amount,
                action,
                description: description ?? action,
                metadata:    metadata ? (metadata as any) : undefined,
            },
        }),
    ])

    await createCreditBucket(billingUserId, amount, action, null)

    return updatedUser.credits_balance
}

/**
 * Ensure a verified free-trial user has their one-time signup bonus.
 * This prevents onboarding from dead-ending when a user reaches the first run
 * before the verification/login credit-award path has refreshed their wallet.
 */
export async function ensureSignupBonusCredits(userId: string): Promise<number> {
    const billingUserId = await resolveBillingUserId(userId)
    await expireCreditBuckets(billingUserId)

    const user = await prisma.user.findUnique({
        where: { id: billingUserId },
        select: { credits_balance: true, is_verified: true, account_type: true },
    })

    if (!user) return 0
    if (!user.is_verified) return user.credits_balance

    const existingBonus = await prisma.creditTransaction.findFirst({
        where: {
            user_id: billingUserId,
            action: "SIGNUP_BONUS",
        },
        select: { id: true },
    })

    if (existingBonus) return user.credits_balance
    if (user.credits_balance > 0) return user.credits_balance

    const signupBonus = signupBonusFor(user.account_type)
    return awardCredits(
        billingUserId,
        signupBonus,
        "SIGNUP_BONUS",
        `${signupBonus} free trial credits`,
        { source: "trial_onboarding_guard" },
    )
}

/**
 * Returns whether the user's balance is below the low-balance warning threshold.
 */
export async function isLowBalance(userId: string): Promise<boolean> {
    const balance = await getCreditBalance(userId)
    return balance < LOW_BALANCE_THRESHOLD
}

/**
 * Fetch paginated credit transaction history for a user.
 */
export async function getCreditTransactions(
    userId: string,
    page:   number = 1,
    limit:  number = 20,
    options: { days?: number; type?: "all" | "credit" | "debit" } = {},
): Promise<{ transactions: object[]; total: number }> {
    const billingUserId = await resolveBillingUserId(userId)
    const skip = (page - 1) * limit
    const safeDays = options.days ? Math.min(Math.max(options.days, 1), 30) : undefined
    const createdAt = safeDays
        ? { gte: new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000) }
        : undefined
    const amount = options.type === "credit"
        ? { gt: 0 }
        : options.type === "debit"
            ? { lt: 0 }
            : undefined
    const where = {
        user_id: billingUserId,
        ...(createdAt ? { created_at: createdAt } : {}),
        ...(amount ? { amount } : {}),
    }

    const [transactions, total] = await Promise.all([
        prisma.creditTransaction.findMany({
            where,
            orderBy: { created_at: "desc" },
            skip,
            take:    limit,
            select: {
                id:          true,
                amount:      true,
                action:      true,
                description: true,
                metadata:    true,
                created_at:  true,
            },
        }),
        prisma.creditTransaction.count({ where }),
    ])

    return { transactions, total }
}

/**
 * Which account (SINGLE vs AGENCY) a user's billing should be evaluated under.
 * Payment-processor-agnostic — used to pick the right plan/credit catalog.
 */
export async function getBillingAudience(userId: string) {
    const billingUserId = await resolveBillingUserId(userId)
    const user = await prisma.user.findUnique({ where: { id: billingUserId }, select: { account_type: true } })
    return user?.account_type ?? AccountType.SINGLE
}

function addMonths(date: Date, months: number) {
    const next = new Date(date)
    const day = next.getDate()
    next.setDate(1)
    next.setMonth(next.getMonth() + months)
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    next.setDate(Math.min(day, lastDay))
    return next
}

/**
 * Grant one month's included plan credits to an active subscription, idempotently
 * keyed by grantKey so retries (webhooks, polling) never double-grant.
 */
export async function grantSubscriptionCredits(subscriptionId: string, grantKey: string, scheduledFor: Date) {
    const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
    if (!subscription || subscription.status === SubscriptionStatus.CANCELED) return { granted: false, credits: 0 }
    const plan = subscription.plan as PaidPlan
    const credits = getBillingPlan(plan).monthly_credits
    const expiresAt = plan === Plan.STARTER ? addMonths(scheduledFor, 1) : null

    try {
        await prisma.$transaction(async tx => {
            await tx.subscriptionCreditGrant.create({
                data: { subscription_id: subscription.id, grant_key: grantKey, credits, scheduled_for: scheduledFor },
            })
            await tx.user.update({
                where: { id: subscription.user_id },
                data: { credits_balance: { increment: credits }, plan },
            })
            await tx.creditTransaction.create({
                data: {
                    user_id: subscription.user_id,
                    idempotency_key: grantKey,
                    amount: credits,
                    action: "PLAN_CREDITS",
                    description: `${getBillingPlan(plan).name} included credits`,
                    metadata: {
                        idempotency_key: grantKey,
                        subscription_id: subscription.id,
                        billing_interval: subscription.billing_interval,
                        scheduled_for: scheduledFor.toISOString(),
                    },
                },
            })
            await tx.creditBucket.create({
                data: {
                    user_id: subscription.user_id,
                    amount_remaining: credits,
                    source: `${plan}_INCLUDED`,
                    expires_at: expiresAt,
                },
            })
        })
        return { granted: true, credits }
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return { granted: false, credits: 0 }
        }
        throw error
    }
}

/**
 * Grant any monthly credit tranches an active annual subscriber is due for
 * (annual plans pay once but receive included credits month by month).
 */
export async function grantDueAnnualSubscriptionCreditsForUser(actorUserId: string) {
    const userId = await resolveBillingUserId(actorUserId)
    const now = new Date()
    const due = await prisma.subscription.findMany({
        where: {
            user_id: userId,
            billing_interval: "annual",
            status: SubscriptionStatus.ACTIVE,
            next_credit_grant_at: { lte: now },
            current_period_end: { gt: now },
        },
    })

    for (const subscription of due) {
        let scheduledFor = subscription.next_credit_grant_at!
        while (scheduledFor <= now && (!subscription.current_period_end || scheduledFor < subscription.current_period_end)) {
            const key = `annual-tranche:${subscription.id}:${scheduledFor.toISOString().slice(0, 10)}`
            await grantSubscriptionCredits(subscription.id, key, scheduledFor)
            scheduledFor = addMonths(scheduledFor, 1)
        }
        await prisma.subscription.update({ where: { id: subscription.id }, data: { next_credit_grant_at: scheduledFor } })
    }
}

/**
 * Create a one-time Stripe Checkout Session (mode: "payment") for a PAYG credit pack.
 * Accepts either a catalog pack_id or a custom credit amount (priced via getCustomCreditPack).
 */
export async function createCreditPackCheckoutSession(
    userId: string,
    input: { pack_id?: string; custom_credits?: number },
    requestId?: string,
) {
    const accountType = await getBillingAudience(userId)
    const pack = input.pack_id
        ? getCreditPack(input.pack_id)
        : input.custom_credits
            ? getCustomCreditPack(input.custom_credits, accountType)
            : null
    if (!pack) throw new Error("Invalid credit pack")

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
    if (!user) throw new Error("User not found")

    const stripe = getStripeClient()
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173"
    const automaticTax = process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true"
    const totalCredits = pack.credits + pack.bonus_credits

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.email,
        client_reference_id: user.id,
        line_items: [
            {
                price_data: {
                    currency: "eur",
                    unit_amount: pack.amount_EUR,
                    product_data: { name: pack.label },
                },
                quantity: 1,
            },
        ],
        success_url: `${frontendUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/billing?checkout=cancelled`,
        billing_address_collection: "required",
        tax_id_collection: { enabled: true },
        automatic_tax: { enabled: automaticTax },
        metadata: {
            user_id: user.id,
            pack_id: pack.id,
            credits: String(totalCredits),
        },
    }, requestId ? { idempotencyKey: `credit-pack-checkout:${user.id}:${requestId}` } : undefined)

    if (!session.url) throw new Error("Stripe checkout session URL was not created")

    return {
        checkout_session_id: session.id,
        checkout_url: session.url,
        pack_id: pack.id,
        credits: totalCredits,
    }
}

/**
 * Award credits from a completed one-time-payment Checkout Session.
 * Called from the Stripe webhook; relies on the webhook's own per-event-id
 * dedup (StripeWebhookEvent) for idempotency, same as invoice/subscription events.
 */
export async function awardCreditPackFromCheckoutSession(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.user_id ?? session.client_reference_id
    const packId = session.metadata?.pack_id
    const credits = Number(session.metadata?.credits)
    if (!userId || !packId || !Number.isFinite(credits) || credits <= 0) {
        throw new Error("Checkout session is missing credit pack metadata")
    }
    await awardCredits(userId, credits, "CREDIT_PACK_PURCHASE", `Purchased ${packId}`, {
        pack_id: packId,
        checkout_session_id: session.id,
    })
}
