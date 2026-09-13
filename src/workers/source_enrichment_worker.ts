import "../lib/env"
import express from "express"
import { Worker } from "bullmq"
import { getRedisConnectionOptions } from "../lib/redis"
import prisma from "../lib/prisma"
import { SOURCE_ENRICHMENT_QUEUE_NAME, type SourceEnrichmentQueueJob } from "../queues/source_enrichment_queue"
import { enrichSource } from "../features/sources/source_enrichment_service"

const worker = new Worker<SourceEnrichmentQueueJob, void, "enrich-source">(
    SOURCE_ENRICHMENT_QUEUE_NAME,
    async job => {
        await enrichSource(job.data.source_id)
    },
    {
        connection: getRedisConnectionOptions(),
        concurrency: Number(process.env.SOURCE_ENRICHMENT_CONCURRENCY ?? 3)
    }
)

worker.on("completed", job => {
    console.log(`Source enrichment completed: ${job.id}`)
})

worker.on("failed", (job, error) => {
    console.error(`Source enrichment failed: ${job?.id}`, error)
})

// Cloud Run kills a container that never binds a port, so the worker only deploys as a
// service if it answers health checks. Locally PORT is unset and no server is started.
if (process.env.PORT) {
    const app = express()
    const port = Number(process.env.PORT)

    app.get("/", (_req, res) => {
        res.json({ service: "source-enrichment-worker", status: "ok", queue: SOURCE_ENRICHMENT_QUEUE_NAME })
    })

    app.get("/health", (_req, res) => {
        res.json({ status: "ok", queue: SOURCE_ENRICHMENT_QUEUE_NAME, worker_running: worker.isRunning() })
    })

    app.listen(port, "0.0.0.0", () => {
        console.log(`Source enrichment worker health server listening on :${port}`)
    })
}

process.on("SIGINT", async () => {
    await worker.close()
    await prisma.$disconnect()
    process.exit(0)
})

process.on("SIGTERM", async () => {
    await worker.close()
    await prisma.$disconnect()
    process.exit(0)
})
