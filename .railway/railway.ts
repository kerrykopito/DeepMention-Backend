import { defineRailway, project, service } from "railway/iac";

// Config as Code (railway.json) is deprecated and, more to the point, Railway does not read it
// for services created after the cutover - scrape-worker is one of those. This file is the only
// thing that configures the service.
//
// Variables are deliberately NOT declared here. They include the database password and the API
// keys, and this file is committed to the repository. They are set on the service itself.
export default defineRailway(() => {
    const scrapeWorker = service("scrape-worker", {
        replicas: { sfo: 1 },

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

            // A hard ceiling on what one run can cost. The worker needs roughly 300-450 MB
            // (Node plus the Prisma engine), so 512 MB leaves headroom without paying for a
            // gigabyte that sits unused.
            limitOverride: {
                containers: {
                    memoryBytes: 536870912,
                },
            },
        },
    })

    return project("DeepMention", {
        resources: [scrapeWorker],
    })
})
