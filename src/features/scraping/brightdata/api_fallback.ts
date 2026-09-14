import { generateText } from "../../llm/gemini_service"
import type { UiEngine, UiScrapeResult } from "./types"
import { normalizeErrorMessage } from "./utils"

export async function runApiFallback(
    engine: UiEngine,
    prompt: string,
    geo: string,
    reason: string
): Promise<UiScrapeResult> {
    // Allow-list, deliberately. This used to read `=== "false"`, which meant that any runtime
    // without the variable - a new environment, a cloned service, a local `npm run worker:scrape`
    // - silently fabricated answers with Gemini and stored them as if they had been scraped. Two
    // of the first three answers in production were invented that way. Fabricating data is now
    // something a runtime has to ask for explicitly; forgetting the variable fails safe.
    if (process.env.SCRAPER_API_FALLBACK_ENABLED !== "true") {
        return {
            engine,
            prompt,
            status: "failed",
            answer_text: null,
            citations: [],
            screenshot_path: null,
            model_label: `${engine}-api-fallback-disabled`,
            error_reason: reason,
            raw_text: null,
            retry_count: 0,
            created_at: new Date().toISOString(),
        }
    }

    try {
        const answer = await generateText(
            [
                "You are an answer-engine API fallback for DeepMention.",
                "Answer the user prompt directly and clearly for brand visibility analysis.",
                "Do not claim you used a live browser or Bright Data.",
                "Do not invent citations or URLs. If you are not using live web search, avoid fake source lists.",
            ].join("\n"),
            [
                `Requested engine: ${engine}`,
                `Requested country: ${geo}`,
                "Prompt:",
                prompt,
            ].join("\n")
        )

        return {
            engine,
            prompt,
            status: "success",
            answer_text: answer,
            citations: [],
            screenshot_path: null,
            model_label: `${engine}-api-fallback`,
            error_reason: `Bright Data fallback reason: ${reason}`,
            raw_text: answer,
            retry_count: 0,
            created_at: new Date().toISOString(),
        }
    } catch (fallbackError) {
        return {
            engine,
            prompt,
            status: "failed",
            answer_text: null,
            citations: [],
            screenshot_path: null,
            model_label: `${engine}-api-fallback-failed`,
            error_reason: [
                `Bright Data error: ${reason}`,
                `API fallback error: ${normalizeErrorMessage(fallbackError)}`,
            ].join(" "),
            raw_text: null,
            retry_count: 0,
            created_at: new Date().toISOString(),
        }
    }
}
