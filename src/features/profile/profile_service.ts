import prisma from "../../lib/prisma"
import { getCreditBalance } from "../credits/credits_service"
import { getEffectivePlanAccess } from "../subscription/entitlements"
import { httpError } from "../../lib/http_error"

export async function getProfileData(userId: string) {
    const [user, projects, wallet, planUsage, access] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                is_verified: true,
                account_type: true,
                role: true,
                plan: true,
                created_at: true,
            },
        }),
        prisma.project.findMany({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
            select: {
                id: true,
                brand_name: true,
                brand_url: true,
                brand_location: true,
                created_at: true,
                updated_at: true,
            },
        }),
        getCreditBalance(userId),
        prisma.planUsage.findFirst({
            where: { user_id: userId },
            orderBy: { period_start: "desc" },
            select: {
                prompt_count: true,
                project_count: true,
                competitor_count: true,
                monthly_runs_used: true,
                period_start: true,
                period_end: true,
            },
        }),
        getEffectivePlanAccess(userId),
    ])

    if (!user) {
        throw httpError(404, "User not found")
    }

    const { getAgencyContext } = await import("../agency/agency_service")
    const agencyContext = await getAgencyContext(userId).catch(() => null)

    return {
        user: {
            ...user,
            // The real plan, from the same source /subscription/quota reads, so the two
            // endpoints cannot disagree about what the account is on. This used to select
            // `plan` from the database above and then overwrite it with the literal "PAYG",
            // which meant a paying subscriber had no way to see what they were paying for —
            // and now that the plan's limits are actually enforced, no way to understand why
            // a cap applied to them.
            plan: access.plan,
            effective_plan: access.effective_plan,
            trial: access.trial,
            agency_role: agencyContext?.role || null,
        },
        projects,
        wallet: {
            balance: wallet.remaining,
            used: wallet.used,
        },
        usage: planUsage ?? {
            prompt_count: 0,
            project_count: 0,
            competitor_count: 0,
            monthly_runs_used: 0,
            period_start: null,
            period_end: null,
        },
    }
}
