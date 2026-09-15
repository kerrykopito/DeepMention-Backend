/**
 * credits_config.ts
 * Centralized configuration for all credit costs in the PAYG system.
 * 1 credit = 1 eurocent (for packs), or a configurable rate set via env.
 */

import { AccountType } from "@prisma/client"

/** Central product policy. Always resolve the billing owner's account type. */
export const ACCOUNT_CREDIT_POLICY = {
    [AccountType.SINGLE]: {
        prompt_run: 1,
        seo_provider_credits_per_usd: 180,
        site_audit: { quick: 4, standard: 8, deep: 15 },
    },
    [AccountType.AGENCY]: {
        prompt_run: 1,
        seo_provider_credits_per_usd: 150,
        site_audit: { quick: 3, standard: 6, deep: 12 },
    },
} as const

export function creditPolicyFor(accountType: AccountType) {
    return ACCOUNT_CREDIT_POLICY[accountType]
}

export function signupBonusFor(accountType: AccountType) {
    return 105 * creditPolicyFor(accountType).prompt_run
}

// The per-action credit prices that used to live here are gone. They were a second, stale copy
// of CREDIT_COSTS in subscription/plan_config.ts - a Reddit scan was priced at 5 here and
// charged at 25 there - and nothing read them: their only consumer was getActionCreditCost,
// reached solely through assertCredits and deductCredits, neither of which had a caller. Every
// live charge goes through credits/credits_service.spendCredits with a cost from CREDIT_COSTS
// or, for a prompt run, from ACCOUNT_CREDIT_POLICY above.

/**
 * Credit pack options available for purchase.
 * amount_EUR: price in eurocents
 * credits: number of credits awarded
 * bonus_credits: additional bonus on top
 */
export const CREDIT_PACKS = [
    {
        id:               "pack_1000",
        label:            "1,000 Credits",
        amount_EUR:       1000,
        credits:          1_000,
        bonus_credits:    0,
    },
    {
        id:               "pack_3000",
        label:            "3,000 Credits",
        amount_EUR:       2500,
        credits:          3_000,
        bonus_credits:    0,
    },
    {
        id:               "pack_10000",
        label:            "10,000 Credits",
        amount_EUR:       8000,
        credits:          10_000,
        bonus_credits:    0,
    },
] as const

/** Agency-only volume packs. The wallet is shared by the agency owner and all
 * active team/client links, while usage remains attributed to the actor/client. */
export const AGENCY_CREDIT_PACKS = [
    {
        id:               "agency_1000",
        label:            "1,000 Agency Credits",
        amount_EUR:       1000,
        credits:          1_000,
        bonus_credits:    0,
    },
    {
        id:               "agency_3000",
        label:            "3,000 Agency Credits",
        amount_EUR:       2_300,
        credits:          3_000,
        bonus_credits:    0,
    },
    {
        id:               "agency_7500",
        label:            "7,500 Agency Credits",
        amount_EUR:       5_500,
        credits:          7_500,
        bonus_credits:    0,
    },
    {
        id:               "agency_15000",
        label:            "15,000 Agency Credits",
        amount_EUR:       10_500,
        credits:          15_000,
        bonus_credits:    0,
    },
] as const

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"]

export function getCreditPack(id: string) {
    return [...CREDIT_PACKS, ...AGENCY_CREDIT_PACKS].find(p => p.id === id) ?? null
}

export function getCustomCreditPack(credits: number, accountType: AccountType = AccountType.SINGLE) {
    if (!Number.isInteger(credits) || credits < 1_000 || credits > 1_000_000) return null
    const agencyRate = credits >= 15_000 ? 0.70 : credits >= 7_500 ? 0.7332 : credits >= 3_000 ? 0.7664 : 1.00
    const rate = accountType === AccountType.AGENCY ? agencyRate : 1.00
    const amountEUR = Math.ceil(credits * rate)
    return {
        id: `custom_${credits}`,
        label: `${credits.toLocaleString("en-IN")} Credits`,
        amount_EUR: amountEUR,
        credits,
        bonus_credits: 0,
    }
}

/** Minimum balance below which we show a low-balance warning in the UI */
export const LOW_BALANCE_THRESHOLD = 50
