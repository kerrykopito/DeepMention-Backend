import { Engine, Plan } from "@prisma/client"
import { PLAN_LIMITS } from "../subscription/plan_config"

export const SELECTABLE_PROJECT_ENGINES: readonly Engine[] = [
    Engine.CHATGPT,
    Engine.GEMINI,
    Engine.PERPLEXITY,
    Engine.GOOGLE_AI_MODE,
    Engine.COPILOT,
]

export const DEFAULT_PROJECT_ENGINES: readonly Engine[] = [
    Engine.CHATGPT,
    Engine.GEMINI,
    Engine.PERPLEXITY,
]

const selectableSet = new Set<Engine>(SELECTABLE_PROJECT_ENGINES)

export function isSelectableProjectEngine(engine: Engine) {
    return selectableSet.has(engine)
}

/**
 * How many engines a plan may track at once. `"all"` in the plan config means every engine
 * this build offers, so it resolves against the selectable list rather than a second hardcoded
 * five that would drift the moment an engine is added or retired.
 *
 * This used to ignore its argument and return the full count for everyone, which is how FREE's
 * declared allowance of three came to be reported by /subscription/quota and enforced nowhere.
 */
export function getEngineLimitForPlan(plan: Plan) {
    const limit = PLAN_LIMITS[plan]?.engine_limit ?? PLAN_LIMITS.FREE.engine_limit
    return limit === "all" ? SELECTABLE_PROJECT_ENGINES.length : limit
}

export function normalizeProjectEngines(input: unknown): Engine[] {
    if (!Array.isArray(input)) return [...DEFAULT_PROJECT_ENGINES]

    const engines = input
        .map(value => String(value).trim().toUpperCase())
        .filter((value): value is Engine => value in Engine)
        .filter(isSelectableProjectEngine)

    return [...new Set(engines)]
}
