import './src/lib/env'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './src/features/auth/auth_routes'
import onboardingRoutes from './src/features/onboarding/onboarding_routes'
import dashboardRoutes from './src/features/dashboard/dashboard_route'
import sourcesRoutes from './src/features/sources/sources_routes'
import brandRoutes from './src/features/brands/brand_routes'
import scrapingRoutes from './src/features/scraping/scraping_routes'
import projectRoutes from './src/features/projects/projects_routes'
import promptRoutes from './src/features/prompts/prompt_routes'
import webAnalyticsRoutes from './src/features/webanalytics/webanalytics_routes'
import subscriptionRoutes from './src/features/subscription/subscription_routes'
import profileRoutes from './src/features/profile/profile_routes'
import settingsRoutes from './src/features/settings/settings_routes'
import helpRoutes from './src/features/help/help_routes'
import exportRoutes from './src/features/exports/export_routes'
import opportunityRoutes from './src/features/opportunities/opportunity_routes'
import geoArticleRoutes from './src/features/geoartciles/geoarticle_routes'
import adminRoutes from './src/features/admin/admin_routes'
import demoRoutes from './src/features/demo/demo_routes'
import productTourRoutes from './src/features/product_tour/product_tour_routes'
import reportRoutes from './src/features/report/report_routes'
import artifactRoutes from './src/features/artifacts/artifact_routes'
import actionQueueRoutes from './src/features/action_queue/action_queue_routes'
import customerSupportAgentRoutes from './src/features/customer_support_agent/customer_support_agent_routes'
import redditIntelligenceRoutes from './src/features/reddit_intelligence/reddit_intelligence_routes'
import brandPreferenceRoutes from './src/features/brand_preferences/brand_preferences_routes'
import agencyRoutes from './src/features/agency/agency_routes'
import { acceptInvitationController } from './src/features/agency/agency_controller'
import paymentsRoutes from './src/features/payments/payments_routes'
import emailCampaignRoutes from './src/features/campaigns/email/email_routes'
import { stripeWebhookController } from './src/features/subscription/subscription_controller'
import { requireAdmin, requireAuth } from './src/middleware/auth'

// The scheduler registers a node-cron timer and a BullMQ queue at import time. In a
// serverless function that timer never fires but does keep the invocation alive, so the
// function hangs on cold start — skip it on Vercel even if the env var is inherited from
// the Cloud Run config. `npm run scheduler:daily` still runs it as its own process.
if (!process.env.VERCEL && process.env.ENABLE_DAILY_SCRAPE_SCHEDULER === "true") {
    void import("./src/scheduler/daily_scheduler")
}

process.on("uncaughtException", error => {
    console.error("Uncaught exception during startup/runtime", error)
})

process.on("unhandledRejection", reason => {
    console.error("Unhandled promise rejection during startup/runtime", reason)
})

const app = express()
const PORT = process.env.PORT || 3000

// One hop (Cloud Run / a single load balancer). Rate limiting reads req.ip, which is the
// proxy's address unless this is set — and trusting every hop would let clients spoof it.
app.set("trust proxy", 1)

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}))
// SECURITY: this was `cors()`, which reflected EVERY origin — any website could drive this
// API from a logged-in victim's browser. Restrict to the known frontends. Extra origins
// (preview deployments, a new domain) can be added via CORS_ALLOWED_ORIGINS as a
// comma-separated list; they are added to, never replace, these defaults.
const DEFAULT_ALLOWED_ORIGINS = [
    "https://deepmention.xyz",
    "https://www.deepmention.xyz",
    "https://app.deepmention.xyz",
    "http://localhost:5173",
    "http://localhost:3000",
]
const allowedOrigins = new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(",").map(origin => origin.trim()).filter(Boolean) ?? []),
])
app.use(cors({
    origin: (origin, callback) => {
        // No Origin header => not a browser cross-origin request (curl, health checks,
        // server-to-server). Those are unaffected by CORS, so allow them through.
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true)
            return
        }
        // Deny by omitting CORS headers rather than throwing, so a blocked origin gets a
        // clean browser-side CORS failure instead of a 500 from the error handler.
        callback(null, false)
    },
    credentials: true,
}))
app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true })
})
app.post('/api/subscription/webhook', express.raw({ type: 'application/json' }), stripeWebhookController)
app.use(express.json({
    verify: (req, _res, buffer) => {
        ;(req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer)
    },
}))
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction): void => {
    if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400 && 'body' in err) {
        res.status(400).json({ success: false, message: 'Malformed JSON payload in request body' })
        return
    }
    next(err)
})

app.use('/api/auth', authRoutes)
app.post('/api/agency/invitations/accept', acceptInvitationController)
app.use('/api/onboarding', requireAuth, onboardingRoutes)
app.use('/api/dashboard', requireAuth, dashboardRoutes)
app.use('/api/sources', requireAuth, sourcesRoutes)
app.use('/api/brands', requireAuth, brandRoutes)
app.use('/api/scraping', requireAuth, scrapingRoutes)
app.use('/api/projects', requireAuth, projectRoutes)
app.use('/api/prompts', requireAuth, promptRoutes)
app.use('/api/subscription', requireAuth, subscriptionRoutes)
app.use('/api/profile', requireAuth, profileRoutes)
app.use('/api/settings', requireAuth, settingsRoutes)
app.use('/api/help', requireAuth, helpRoutes)
app.use('/api/exports', requireAuth, exportRoutes)
app.use('/api/opportunities', requireAuth, opportunityRoutes)
app.use('/api/geoarticles', requireAuth, geoArticleRoutes)
app.use('/api/product-tour', requireAuth, productTourRoutes)
app.use('/api/reports', requireAuth, reportRoutes)
app.use('/api/artifacts', requireAuth, artifactRoutes)
app.use('/api/action-queue', requireAuth, actionQueueRoutes)
app.use('/api/customer-support-agent', requireAuth, customerSupportAgentRoutes)
app.use('/api/reddit-intelligence', requireAuth, redditIntelligenceRoutes)
app.use('/api/brand-preferences', requireAuth, brandPreferenceRoutes)
app.use('/api/agency', requireAuth, agencyRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes)
app.use('/api/campaigns/email', requireAuth, emailCampaignRoutes)
app.use('/api/webanalytics', webAnalyticsRoutes)
app.use('/api/demo', demoRoutes)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction): void => {
    console.error("Unhandled API Error:", err)
    res.status(500).json({ success: false, message: 'Internal server error' })
})

// On Vercel the app runs as a serverless function (see api/index.ts), which imports this
// module and uses the exported `app` — it must NOT call listen() there. Locally / on
// Cloud Run we still start a normal HTTP server.
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
    })
}

export default app
