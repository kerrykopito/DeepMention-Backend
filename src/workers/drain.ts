import type { Queue } from "bullmq"

/**
 * Waits until a BullMQ queue has nothing left to do, then resolves.
 *
 * This exists so the scrape worker can run as a scheduled job (Railway cron, Cloud Run Job)
 * instead of a service that is billed around the clock. Railway charges for memory by the
 * second for as long as a service is up, so a consumer that idles 23 hours a day costs roughly
 * five times what the same work costs when it starts, drains and exits.
 *
 * "Nothing left to do" counts delayed jobs as pending, not as done. The enqueuer spaces jobs
 * out with SCRAPE_QUEUE_SPACING_MS, so immediately after a run is queued nearly every job is
 * delayed rather than waiting - exiting on an empty `waiting` count alone would quit before
 * doing any work at all.
 */
export type DrainOptions = {
    /** Give up and shut down after this long, however much is left. Protects against a stuck
     *  job billing until someone notices. */
    maxMs?: number
    /** How often to look at the queue. */
    pollMs?: number
    /** Consecutive empty readings required before believing it. Guards against the gap between
     *  one job finishing and the next being moved into active. */
    confirmations?: number
    onStatus?: (message: string) => void
}

export type DrainResult = {
    drained: boolean
    reason: "empty" | "timeout"
    elapsedMs: number
}

export async function waitUntilDrained(
    queue: Pick<Queue, "getJobCounts">,
    options: DrainOptions = {}
): Promise<DrainResult> {
    const maxMs = options.maxMs ?? Number(process.env.SCRAPE_DRAIN_MAX_MS ?? 3_600_000)
    const pollMs = options.pollMs ?? Number(process.env.SCRAPE_DRAIN_POLL_MS ?? 5_000)
    const confirmations = options.confirmations ?? 2
    const log = options.onStatus ?? (message => console.log(message))

    const startedAt = Date.now()
    let consecutiveEmpty = 0

    for (;;) {
        const counts = await queue.getJobCounts()
        const pending =
            (counts.active ?? 0) +
            (counts.waiting ?? 0) +
            (counts.delayed ?? 0) +
            (counts.prioritized ?? 0) +
            (counts.paused ?? 0)

        if (pending === 0) {
            consecutiveEmpty += 1
            if (consecutiveEmpty >= confirmations) {
                const elapsedMs = Date.now() - startedAt
                log(`[drain] queue empty after ${Math.round(elapsedMs / 1000)}s - shutting down`)
                return { drained: true, reason: "empty", elapsedMs }
            }
        } else {
            consecutiveEmpty = 0
            log(
                `[drain] pending=${pending} (active=${counts.active ?? 0} waiting=${counts.waiting ?? 0} delayed=${counts.delayed ?? 0})`
            )
        }

        const elapsedMs = Date.now() - startedAt
        if (elapsedMs >= maxMs) {
            log(`[drain] hit the ${Math.round(maxMs / 1000)}s limit with ${pending} job(s) left - shutting down anyway`)
            return { drained: false, reason: "timeout", elapsedMs }
        }

        await new Promise(resolve => setTimeout(resolve, Math.min(pollMs, maxMs - elapsedMs)))
    }
}
