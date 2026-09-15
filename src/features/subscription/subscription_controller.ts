import type { Request, Response } from "express"
import { Plan } from "@prisma/client"
import type { AuthenticatedRequest } from "../../middleware/auth"
import {
    canAddCompetitor,
    canCreateProject,
    canCreatePrompt,
    canExport,
    canRunRefresh,
    createSubscription,
    getMyPlan,
    getPlanLimits,
    getPlanQuota,
    createBillingPortalSession,
    verifyCheckoutSession,
    refreshPlanUsage,
} from "./subscription_service"
import { handleStripeWebhook } from "./stripe_webhook_service"
import { listBillingInvoices } from "./billing_invoice_service"
import { getErrorStatus, resolveErrorResponse } from "../../lib/http_error"

function fail500(res: Response, route: string, error: unknown, fallback: string): void {
    console.error(`[subscription_controller:${route}]`, error)
    res.status(500).json({ error: fallback })
}

export async function createSubscriptionController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        const { plan, billing_interval, request_id } = req.body as { plan?: Plan; billing_interval?: "monthly" | "annual"; request_id?: string }

        const checkout = await createSubscription({
            user_id: userId,
            plan: plan as Exclude<Plan, "FREE">,
            billing_interval: billing_interval ?? "monthly",
            request_id,
        })

        res.status(201).json(checkout)
    } catch (error) {
        // 400, 404 and 409 now travel on the errors themselves, so this no longer has to
        // recognise three exact sentences to get the status right.
        const { status, message, unexpected } = resolveErrorResponse(error, "Failed to create subscription")
        if (unexpected) {
            fail500(res, "createSubscription", error, "Failed to create subscription")
            return
        }
        res.status(status).json({ error: message })
    }
}

export async function createBillingPortalController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id } } = req as AuthenticatedRequest
        res.json(await createBillingPortalSession(id))
    } catch (error) {
        // An unrecognised failure has always been answered 400 here rather than 500. That is
        // preserved rather than endorsed: this change is about classifying errors, not about
        // restating what each route replies when something unexpected goes wrong.
        const { status, message, unexpected } = resolveErrorResponse(error, "Failed to open billing portal", { fallbackStatus: 400 })
        if (unexpected) {
            console.error("[subscription_controller:createBillingPortal]", error)
        }
        res.status(status).json({ error: message })
    }
}

export async function verifyCheckoutController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id } } = req as AuthenticatedRequest
        const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId
        res.json(await verifyCheckoutSession(id, sessionId))
    } catch (error) {
        // This answered 404 unconditionally: a Stripe outage or a bug in verifyCheckoutSession
        // was reported to the client as "Checkout session not found", which sends someone whose
        // payment did go through looking for a session that exists. Only the deliberate 404 is
        // a 404 now; anything else is logged and reported as the server fault it is.
        const { status, message, unexpected } = resolveErrorResponse(error, "Failed to verify checkout session")
        if (unexpected) {
            console.error("[subscription_controller:verifyCheckout]", error)
        }
        res.status(status).json({ error: message })
    }
}

export async function listBillingInvoicesController(req: Request, res: Response): Promise<void> {
    const { user: { id } } = req as AuthenticatedRequest
    res.json({ invoices: await listBillingInvoices(id) })
}

export async function getMyPlanController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        const plan = await getMyPlan(userId)

        res.status(200).json(plan)
    } catch (error) {
        fail500(res, "getMyPlan", error, "Failed to get subscription plan")
    }
}

export async function getPlanLimitsController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        const limits = await getPlanLimits(userId)

        res.status(200).json(limits)
    } catch (error) {
        fail500(res, "getPlanLimits", error, "Failed to get plan limits")
    }
}

export async function getPlanQuotaController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        const quota = await getPlanQuota(userId)

        res.status(200).json(quota)
    } catch (error) {
        fail500(res, "getPlanQuota", error, "Failed to get plan quota")
    }
}

export async function stripeWebhookController(req: Request, res: Response): Promise<void> {
    try {
        const signature = req.headers["stripe-signature"]
        const result = await handleStripeWebhook(
            req.body as Buffer,
            Array.isArray(signature) ? signature[0] : signature,
        )

        res.status(200).json(result)
    } catch (error) {
        // Both branches are logged, because a rejected signature usually means a misconfigured
        // endpoint secret rather than an attack. The failure to verify is tagged 400 where it
        // is raised, so a webhook whose *processing* fails - which may well mention a
        // signature somewhere in its message - is no longer reported to Stripe as a bad
        // signature, which would have told it not to retry.
        console.error("[subscription_controller:stripeWebhook]", error)
        const isSignatureError = getErrorStatus(error) === 400
        res.status(isSignatureError ? 400 : 500).json({
            error: isSignatureError ? "Invalid webhook signature" : "Failed to handle Stripe webhook",
        })
    }
}

export async function canCreateProjectController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        const result = await canCreateProject(userId)

        res.status(200).json(result)
    } catch (error) {
        fail500(res, "canCreateProject", error, "Failed to check project limit")
    }
}

export async function canCreatePromptController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        const result = await canCreatePrompt(userId)

        res.status(200).json(result)
    } catch (error) {
        fail500(res, "canCreatePrompt", error, "Failed to check prompt limit")
    }
}

export async function canAddCompetitorController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        const result = await canAddCompetitor(userId)

        res.status(200).json(result)
    } catch (error) {
        fail500(res, "canAddCompetitor", error, "Failed to check competitor limit")
    }
}

export async function canRunRefreshController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        const result = await canRunRefresh(userId)

        res.status(200).json(result)
    } catch (error) {
        fail500(res, "canRunRefresh", error, "Failed to check refresh limit")
    }
}

export async function canExportController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        const result = await canExport(userId)

        res.status(200).json(result)
    } catch (error) {
        fail500(res, "canExport", error, "Failed to check export access")
    }
}

export async function refreshPlanUsageController(req: Request, res: Response): Promise<void> {
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        const usage = await refreshPlanUsage(userId)

        res.status(200).json(usage)
    } catch (error) {
        fail500(res, "refreshPlanUsage", error, "Failed to refresh plan usage")
    }
}
