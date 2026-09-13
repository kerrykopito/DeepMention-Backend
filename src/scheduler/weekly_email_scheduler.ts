import "../lib/env"
import express from "express"
import cron from "node-cron"
import { sendWeeklyEmailReports } from "../features/email/weekly_report_service"

const expression = process.env.WEEKLY_EMAIL_REPORT_CRON ?? "0 9 * * 1"
const timezone = process.env.WEEKLY_EMAIL_REPORT_TIMEZONE ?? "Asia/Kolkata"

cron.schedule(expression, async () => {
    try {
        const result = await sendWeeklyEmailReports()
        console.log(`Weekly email scheduler finished: ${result.reports.length} project reports checked`)
    } catch (error) {
        console.error("Weekly email scheduler failed", error)
    }
}, { timezone })

console.log(`Weekly email scheduler active: ${expression} ${timezone}`)

// Cloud Run kills a container that never binds a port. Deploying this as an always-on
// service is wasteful for one weekly send — prefer the one-shot `weekly-email:send`
// script as a scheduled Job — but this keeps the service shape viable either way.
if (process.env.PORT) {
    const app = express()
    const port = Number(process.env.PORT)

    app.get("/", (_req, res) => {
        res.json({ service: "weekly-email-scheduler", status: "ok", cron: expression, timezone })
    })

    app.get("/health", (_req, res) => {
        res.json({ status: "ok", cron: expression, timezone })
    })

    app.listen(port, "0.0.0.0", () => {
        console.log(`Weekly email scheduler health server listening on :${port}`)
    })
}
