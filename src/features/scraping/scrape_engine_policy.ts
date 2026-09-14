import { Engine } from "@prisma/client"
import { hasScraperId } from "./brightdata/engine_registry"
import type { UiEngine } from "./brightdata/types"

// The Prisma enum and the Bright Data engine keys are spelled differently. This mapping also
// exists in scrape_worker.ts and brightdata_batch_service.ts; it belongs in one place, but
// unifying the three is a wider change than the fix this comment sits in.
const UI_ENGINE_BY_ENUM: Record<Engine, UiEngine> = {
    CHATGPT: "chatgpt",
    GEMINI: "gemini",
    PERPLEXITY: "perplexity",
    GOOGLE_AI_MODE: "google_ai_mode",
    GOOGLE_AI_OVERVIEW: "google_ai_overview",
    COPILOT: "copilot",
}

export const ACTIVE_SCRAPE_ENGINES: readonly Engine[] = [
    Engine.CHATGPT,
    Engine.GEMINI,
    Engine.PERPLEXITY,
    Engine.GOOGLE_AI_MODE,
    Engine.COPILOT,
]

const activeEngineSet = new Set<Engine>(ACTIVE_SCRAPE_ENGINES)

export function isActiveScrapeEngine(engine: Engine): boolean {
    return activeEngineSet.has(engine)
}

/**
 * The engines this runtime can actually scrape. An engine without a Bright Data dataset id is
 * not queued, rather than queued and failed once per job.
 *
 * This used to special-case COPILOT alone, on the assumption that every other engine carried a
 * default id. Only chatgpt, perplexity and google_ai_mode do - gemini and copilot resolve
 * purely from the environment. So on any runtime where BRIGHT_DATA_GEMINI_SCRAPER_ID was not
 * set, GEMINI passed this filter, got queued, and then threw "scraper ID is missing" in
 * client.ts for every single job. That is exactly the shape of failure that hides: it looks
 * like a scraping problem in the logs, not a missing variable, and the drain still exits
 * cleanly around it.
 */
export function activeConfiguredEngines(): Engine[] {
    return ACTIVE_SCRAPE_ENGINES.filter(engine => hasScraperId(UI_ENGINE_BY_ENUM[engine]))
}
