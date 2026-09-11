import { Plan } from "@prisma/client"
import type { PlanLimits } from "./subscription_types"

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
    FREE: {
        projects: 1,
        prompts: 5,
        competitors: 3,
        refreshes_per_week: 0,
        exports: "none",
        credits: 0,
        engine_limit: 3,
    },
    STARTER: {
        projects: 1,
        prompts: 15,
        competitors: 3,
        refreshes_per_week: "daily",
        exports: "full",
        credits: 2250,
        engine_limit: "all",
    },
    GROWTH: {
        projects: 2,
        prompts: 30,
        competitors: 6,
        refreshes_per_week: "daily",
        exports: "full",
        credits: 5000,
        engine_limit: "all",
    },
    PRO: {
        projects: 5,
        prompts: 75,
        competitors: 15,
        refreshes_per_week: "daily",
        exports: "full",
        credits: 13000,
        engine_limit: "all",
    },
    // Agency is a dedicated Pay-As-You-Go plan.
    // No base credits — agencies buy credits as they consume them across client projects.
}

export const CREDIT_COSTS = {
    prompt_run: 3, // legacy individual fallback; live charges use the account-aware policy
    dashboard_export_xlsx: 1,
    dashboard_export_pdf: 0,
    geo_article_pdf: 0,
    ai_visibility_report: 25,
    ai_report_ppt: 0,
    content_brief: 15,
    full_article: 30,
    weekly_email_report: 25,
    reddit_intelligence_standard: 25,
    reddit_intelligence_deep: 50,
    seo_audit: 15,
} as const

export function getPromptLimitForPlan(plan: Plan) {
    return PLAN_LIMITS[plan]?.prompts ?? PLAN_LIMITS.FREE.prompts
}

export function getProjectLimitForPlan(plan: Plan) {
    return PLAN_LIMITS[plan]?.projects ?? PLAN_LIMITS.FREE.projects
}
