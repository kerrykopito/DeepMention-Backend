import { defineRailway, preserve, project, service } from "railway/iac";

// Config as Code (railway.json) is deprecated and, more to the point, Railway does not read it
// for services created after the cutover - scrape-worker is one of those. This file is the only
// thing that configures the service.
//
// Every variable the service needs has to appear here, because this file is authoritative:
// `railway config apply` deletes anything it does not declare. Leaving them out - which this
// file used to do, to keep secrets out of the repository - meant a plan that quietly proposed
// destroying all eleven, the database URL and the API keys among them.
//
// preserve() is the way to have both: the name is declared so it survives an apply, and the
// value stays only on the service and never enters source control. The settings that are not
// secret are declared literally instead, which also puts them under review - WORKER_KIND in
// particular decides whether this container drains and exits or runs forever, and it used to
// exist only in the dashboard where nothing could verify it.
export default defineRailway(() => {
    const scrapeWorker = service("scrape-worker", {
        replicas: { sfo: 1 },

        variables: {
            DATABASE_URL: preserve(),
            REDIS_URL: preserve(),
            BRIGHT_DATA_API_KEY: preserve(),
            GEMINI_API_KEY: preserve(),
            GROQ_API_KEY: preserve(),

            // Which Bright Data dataset to drive per engine. Only chatgpt, perplexity and
            // google_ai_mode carry a default in code; gemini and copilot resolve purely from
            // here, so an unset id used to mean every job for that engine threw at runtime.
            // They are not credentials, but they are account-specific, so preserve() keeps
            // them out of the repository alongside the keys.
            BRIGHT_DATA_GEMINI_SCRAPER_ID: preserve(),
            BRIGHT_DATA_COPILOT_SCRAPER_ID: preserve(),
            BRIGHT_DATA_CHATGPT_SCRAPER_ID: preserve(),
            BRIGHT_DATA_PERPLEXITY_SCRAPER_ID: preserve(),
            BRIGHT_DATA_GOOGLE_AI_MODE_SCRAPER_ID: preserve(),

            // Selects the drain shape in docker-entrypoint.worker.sh, whose default is the
            // always-on worker - so losing this value turns the cron job into a service that
            // never stops billing.
            WORKER_KIND: "drain",

            // Never fabricate an answer with Gemini when a scrape fails. The guard reads
            // `!== "true"`, so this is belt and braces rather than the only protection.
            SCRAPER_API_FALLBACK_ENABLED: "false",

            // One run's time budget. A drain that hits it exits non-zero, so an incomplete
            // sweep is visible rather than silent.
            SCRAPE_DRAIN_MAX_MS: "900000",

            // Jobs spend their time waiting on Bright Data rather than on CPU - a single job
            // takes 32-75s and uses almost none - so concurrency multiplies throughput almost
            // linearly. BullMQ's own limiter (10 per 60s) is the real ceiling above this.
            SCRAPE_WORKER_CONCURRENCY: "5",

            NODE_ENV: "production",

            // Supabase's CA, baked into the image, used to verify the database certificate.
            DB_SSL_CA_PATH: "./certs/prod-ca-2021.crt",
        },

        // The same image that Cloud Build produces for Cloud Run, so the two platforms cannot
        // drift apart. WORKER_KIND=drain is what selects the exit-when-empty behaviour.
        build: {
            builder: "DOCKERFILE",
            dockerfilePath: "Dockerfile.worker",
        },

        deploy: {
            // 03:00 UTC daily. The queue is filled once a day by the scheduler, so draining it
            // once a day is the matching shape - and it costs roughly a fifth of what the same
            // worker costs kept up around the clock, because Railway bills memory per second
            // for as long as a service is running.
            cronSchedule: "0 3 * * *",

            // Load-bearing. The drain worker exits 0 when the queue is empty; with any other
            // restart policy Railway reads that clean exit as a crash and starts it again,
            // which silently turns a scheduled job back into an always-on service.
            restartPolicyType: "NEVER",

            // A hard ceiling on what one run can cost. Node plus the Prisma engine needs
            // roughly 300-450 MB at rest, and each concurrent job holds a scraped answer on
            // top of that. Railway bills memory per second, so a gigabyte for twenty minutes
            // costs less than half a gigabyte for the hour and three quarters the same queue
            // takes at concurrency 1 - the run simply finishes sooner.
            limitOverride: {
                containers: {
                    memoryBytes: 1073741824,
                },
            },
        },
    })

    return project("DeepMention", {
        resources: [scrapeWorker],
    })
})
