import type Stripe from "stripe"
import prisma from "../../lib/prisma"
import { processFailedInvoice, processPaidInvoice, getInvoiceSubscriptionId } from "./billing_invoice_service"
import { getStripeClient, getStripeId } from "./stripe_config"
import { httpError } from "../../lib/http_error"
import { syncSubscriptionFromStripe } from "./subscription_service"
import { awardCreditPackFromCheckoutSession } from "../payments/credits_service"

async function beginEvent(event: Stripe.Event) {
    const existing = await prisma.stripeWebhookEvent.findUnique({ where: { stripe_event_id: event.id } })
    if (existing?.status === "COMPLETE") return false
    if (existing?.status === "PROCESSING" && Date.now() - existing.updated_at.getTime() < 5 * 60 * 1000) return false
    if (existing) {
        await prisma.stripeWebhookEvent.update({ where: { id: existing.id }, data: { status: "PROCESSING", error_reason: null } })
        return true
    }
    try {
        await prisma.stripeWebhookEvent.create({ data: { stripe_event_id: event.id, event_type: event.type } })
        return true
    } catch {
        return false
    }
}

async function syncInvoiceSubscription(invoice: Stripe.Invoice) {
    const subscriptionId = getInvoiceSubscriptionId(invoice)
    if (!subscriptionId) return
    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId)
    await syncSubscriptionFromStripe(subscription)
}

async function processEvent(event: Stripe.Event) {
    const stripe = getStripeClient()
    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === "payment") {
            await awardCreditPackFromCheckoutSession(session)
            return
        }
        const subscriptionId = getStripeId(session.subscription)
        if (subscriptionId) await syncSubscriptionFromStripe(await stripe.subscriptions.retrieve(subscriptionId))
        return
    }
    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
        await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription)
        return
    }
    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
        const invoice = event.data.object as Stripe.Invoice
        await syncInvoiceSubscription(invoice)
        await processPaidInvoice(invoice)
        return
    }
    if (event.type === "invoice.payment_failed" || event.type === "invoice.payment_action_required") {
        const invoice = event.data.object as Stripe.Invoice
        await syncInvoiceSubscription(invoice)
        await processFailedInvoice(invoice)
    }
}

export async function handleStripeWebhook(rawBody: Buffer | string, signature: string | undefined) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    // A missing secret is really a deployment fault rather than a bad request, but the
    // controller has always answered 400 to it and this change is a reclassification of
    // errors, not of statuses: the 400 is preserved deliberately rather than by accident.
    if (!secret) throw httpError(400, "STRIPE_WEBHOOK_SECRET is required")
    if (!signature) throw httpError(400, "Missing Stripe signature")

    let event: Stripe.Event
    try {
        event = getStripeClient().webhooks.constructEvent(rawBody, signature, secret)
    } catch (error) {
        // constructEvent rejects a body whose signature does not verify, which is the
        // sender's problem. Tagging it here is what lets the controller answer "Invalid
        // webhook signature" without searching the message for the word "signature" - and
        // without confusing it with a failure from processing the event further down.
        throw httpError(400, error instanceof Error ? error.message : "Invalid webhook signature")
    }
    if (!(await beginEvent(event))) return { received: true, duplicate: true, event_type: event.type }

    try {
        await processEvent(event)
        await prisma.stripeWebhookEvent.update({ where: { stripe_event_id: event.id }, data: { status: "COMPLETE", processed_at: new Date(), error_reason: null } })
        return { received: true, duplicate: false, event_type: event.type }
    } catch (error) {
        await prisma.stripeWebhookEvent.update({ where: { stripe_event_id: event.id }, data: { status: "FAILED", error_reason: error instanceof Error ? error.message : String(error) } })
        throw error
    }
}
