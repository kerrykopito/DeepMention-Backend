import { AccountType, Plan } from "@prisma/client"
import { creditPolicyFor } from "./credits_config"

export type PaidPlan = Exclude<Plan, "FREE">
export type BillingInterval = "monthly" | "annual"

export type BillingPlan = {
    id: PaidPlan
    name: string
    monthly_amount_EUR: number
    annual_amount_EUR: number
    monthly_credits: number
    base_credits: number
    bonus_credits: number
    detail: string
    expiry: string
}

/**
 * Authoritative EUR product catalog. Amounts are in cents.
 * Annual prices are the monthly price x12 with a 10% commitment discount,
 * presented as clean effective-monthly amounts.
 */
export const BILLING_PLANS: Record<PaidPlan, BillingPlan> = {
    STARTER: {
        id: Plan.STARTER,
        name: "Starter",
        monthly_amount_EUR: 5_000,
        annual_amount_EUR: 54_000,
        monthly_credits: 2_250,
        base_credits: 2_250,
        bonus_credits: 0,
        detail: "For validating one brand",
        expiry: "Included credits reset each month",
    },
    GROWTH: {
        id: Plan.GROWTH,
        name: "Growth",
        monthly_amount_EUR: 8_000,
        annual_amount_EUR: 86_400,
        monthly_credits: 5_000,
        base_credits: 4_500,
        bonus_credits: 500,
        detail: "Best-value monthly capacity",
        expiry: "Unused included credits roll over",
    },
    PRO: {
        id: Plan.PRO,
        name: "Pro",
        monthly_amount_EUR: 11_000,
        annual_amount_EUR: 118_800,
        monthly_credits: 13_000,
        base_credits: 11_250,
        bonus_credits: 1_750,
        detail: "For higher-capacity teams and agencies",
        expiry: "Unused included credits roll over",
    },
}

export function getBillingPlan(plan: PaidPlan) {
    return BILLING_PLANS[plan]
}

export function getPlanAmountEUR(plan: PaidPlan, interval: BillingInterval) {
    const item = getBillingPlan(plan)
    // Both monthly and annual intervals are billed monthly, but annual gets a discount
    return interval === "annual" ? Math.floor(item.annual_amount_EUR / 12) : item.monthly_amount_EUR
}

export function publicBillingCatalog(accountType: AccountType) {
    const policy = creditPolicyFor(accountType)
    return {
        currency: "EUR",
        annual_discount_percent: 10,
        account_type: accountType,
        wallet_mode: accountType === AccountType.AGENCY ? "SHARED_AGENCY" : "INDIVIDUAL",
        credit_policy: {
            successful_ai_engine_check: policy.prompt_run,
            seo_provider_credits_per_usd: policy.seo_provider_credits_per_usd,
            site_audit: policy.site_audit,
            failed_provider_run: 0,
            cached_report: 0,
        },
        plans: (accountType === AccountType.AGENCY ? [] : Object.values(BILLING_PLANS)).map(plan => ({
            ...plan,
            annual_effective_monthly_EUR: Math.floor(plan.annual_amount_EUR / 12),
            annual_credits: plan.monthly_credits * 12,
            annual_credit_delivery: "monthly",
        })),
    }
}
