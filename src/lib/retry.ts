import axios from "axios"

/**
 * Retry for outbound HTTP calls to third parties.
 *
 * The scraping and enrichment paths call Bright Data, Firecrawl, Parallel and arbitrary source
 * URLs with no retry of their own. The queue gives one coarse whole-job retry a minute later,
 * which re-runs the entire job — a 30-75s scrape included — to recover from what is often a
 * single dropped connection. A bounded retry around the individual call is both cheaper and
 * more likely to succeed, because it happens while the rest of the job's state is still warm.
 *
 * What is deliberately *not* retried matters as much as what is. A 4xx other than 429 means the
 * request was wrong, and sending it again produces the same answer more slowly — and on a
 * metered API, at the same price each time.
 */

export type RetryOptions = {
    /** Total attempts including the first. */
    attempts?: number
    /** Delay before the second attempt; each subsequent wait doubles. */
    baseDelayMs?: number
    /** Upper bound on any single wait, so a long backoff cannot outlive the job's own budget. */
    maxDelayMs?: number
    /** Identifies the call in logs. */
    label: string
    /** Overrides the default transient-failure test. */
    isRetryable?: (error: unknown) => boolean
}

/**
 * Network-level failures and the server-side statuses that mean "try again": 408, 429, and any
 * 5xx. A response the caller chose to accept via validateStatus never reaches here, because it
 * is not thrown.
 */
export function isTransientHttpError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
        // A non-axios throw is a bug in our own code far more often than a transient fault, and
        // retrying it just repeats the bug.
        return false
    }

    if (error.response) {
        const status = error.response.status
        return status === 408 || status === 429 || status >= 500
    }

    // No response at all: DNS, connection reset, socket hang-up, timeout. These are the cases
    // this helper exists for.
    const code = error.code ?? ""
    return [
        "ECONNRESET", "ECONNREFUSED", "ECONNABORTED", "ETIMEDOUT", "EAI_AGAIN",
        "EPIPE", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "ERR_NETWORK",
    ].includes(code)
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
    const attempts = Math.max(1, options.attempts ?? 3)
    const baseDelayMs = options.baseDelayMs ?? 500
    const maxDelayMs = options.maxDelayMs ?? 8000
    const isRetryable = options.isRetryable ?? isTransientHttpError

    let lastError: unknown

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error
            if (attempt === attempts || !isRetryable(error)) throw error

            // Full jitter. Several jobs run concurrently against the same provider, so a
            // fixed backoff would have them all retry in the same instant and reproduce
            // whatever overload caused the failure.
            const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
            const delay = Math.floor(Math.random() * ceiling)
            const reason = error instanceof Error ? error.message : String(error)
            console.warn(`[retry] ${options.label} attempt ${attempt}/${attempts} failed (${reason}); retrying in ${delay}ms`)
            await sleep(delay)
        }
    }

    throw lastError
}
