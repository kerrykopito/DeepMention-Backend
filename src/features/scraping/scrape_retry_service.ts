import { Engine, ScrapeJobStatus, VisibilityRunStatus } from "@prisma/client"
import prisma from "../../lib/prisma"
import { ACTIVE_SCRAPE_ENGINES, activeConfiguredEngines, isActiveScrapeEngine } from "./scrape_engine_policy"
import { getProjectEngines } from "../project_engines/project_engines_service"
import { assertScrapingEnabled } from "./scrape_gate"

export const MAX_MANUAL_SCRAPE_RETRIES = 2

export async function retryFailedJobsForRun(run_id: string) {
    assertScrapingEnabled()
    const run = await prisma.run.findUnique({
        where: { id: run_id },
        select: { id: true, project_id: true },
    })

    if (!run) throw new Error("RUN_NOT_FOUND")

    const failedJobs = await prisma.scrapeJob.findMany({
        where: {
            run_id,
            status: ScrapeJobStatus.FAILED,
            chat_id: null,
        },
        select: {
            id: true,
            engine: true,
            retry_count: true,
        },
        orderBy: { created_at: "asc" },
    })

    // The same intersection the enqueue path takes: an engine the project selected, that this
    // build scrapes, and that this runtime has a Bright Data scraper id for. The third test
    // was missing here, so a retry could requeue an engine whose id is unset - the job would
    // be accepted, then throw "scraper ID is missing" once per attempt. That is precisely the
    // failure activeConfiguredEngines() was written to prevent on the enqueue side, and it was
    // still reachable through POST /runs/:run_id/retry-failed.
    const configuredEngineSet = new Set(activeConfiguredEngines())
    const projectEngineSet = new Set(await getProjectEngines(run.project_id))
    const isRetryableEngine = (engine: Engine) =>
        isActiveScrapeEngine(engine) && projectEngineSet.has(engine) && configuredEngineSet.has(engine)

    const eligibleJobs = failedJobs.filter(job => (
        isRetryableEngine(job.engine) && job.retry_count < MAX_MANUAL_SCRAPE_RETRIES
    ))
    const exhaustedJobs = failedJobs.filter(job => (
        isRetryableEngine(job.engine) && job.retry_count >= MAX_MANUAL_SCRAPE_RETRIES
    ))
    const unsupportedJobs = failedJobs.filter(job => job.engine === Engine.GOOGLE_AI_OVERVIEW)

    if (eligibleJobs.length === 0) {
        return {
            run_id,
            queued: 0,
            exhausted: exhaustedJobs.length,
            unsupported: unsupportedJobs.length,
            jobs: [],
        }
    }

    const eligibleIds = eligibleJobs.map(job => job.id)

    let queuedCount = 0
    await prisma.$transaction(async tx => {
        const updated = await tx.scrapeJob.updateMany({
            where: {
                id: { in: eligibleIds },
                run_id,
                status: ScrapeJobStatus.FAILED,
                chat_id: null,
                retry_count: { lt: MAX_MANUAL_SCRAPE_RETRIES },
                // Same predicate the eligibility filter used, so the guard in the WHERE clause
                // and the list of ids it is guarding cannot disagree.
                engine: { in: [...ACTIVE_SCRAPE_ENGINES].filter(isRetryableEngine) },
            },
            data: {
                status: ScrapeJobStatus.QUEUED,
                started_at: null,
                completed_at: null,
                error_reason: null,
                retry_count: { increment: 1 },
            },
        })

        if (updated.count === 0) return
        queuedCount = updated.count

        await tx.brightDataBatchItem.deleteMany({
            where: { scrape_job_id: { in: eligibleIds } },
        })
        await tx.run.update({
            where: { id: run_id },
            data: {
                status: VisibilityRunStatus.QUEUED,
                completed_at: null,
                error_reason: null,
            },
        })
    }, { isolationLevel: "Serializable" })

    const jobs = await prisma.scrapeJob.findMany({
        where: {
            id: { in: eligibleIds },
        },
        select: {
            id: true,
            engine: true,
            status: true,
            retry_count: true,
        },
        orderBy: { created_at: "asc" },
    })

    return {
        run_id,
        queued: queuedCount,
        exhausted: exhaustedJobs.length,
        unsupported: unsupportedJobs.length,
        jobs,
    }
}
