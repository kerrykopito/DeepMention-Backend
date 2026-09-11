import type { Request, Response } from "express"
import type { AuthenticatedRequest } from "../../middleware/auth"
import { getCreditBalance, getCreditTransactions, isLowBalance, getBillingAudience, grantDueAnnualSubscriptionCreditsForUser } from "./credits_service"
import { AGENCY_CREDIT_PACKS, CREDIT_PACKS } from "./credits_config"
import { publicBillingCatalog } from "./billing_catalog"

/** GET /api/payments/balance */
export async function getBalanceController(req: Request, res: Response): Promise<void> {
    const { user: { id: userId } } = req as AuthenticatedRequest
    await grantDueAnnualSubscriptionCreditsForUser(userId)
    const balance = await getCreditBalance(userId)
    const lowBalance = await isLowBalance(userId)
    res.json({ credits_balance: balance, low_balance: lowBalance })
}

/** GET /api/payments/packs */
export async function getCreditPacksController(req: Request, res: Response): Promise<void> {
    const { user: { id: userId } } = req as AuthenticatedRequest
    const audience = await getBillingAudience(userId)
    res.json({
        packs: audience === "AGENCY" ? AGENCY_CREDIT_PACKS : CREDIT_PACKS,
        account_type: audience,
    })
}

/** GET /api/payments/catalog */
export async function getBillingCatalogController(req: Request, res: Response): Promise<void> {
    const { user: { id: userId } } = req as AuthenticatedRequest
    const audience = await getBillingAudience(userId)
    res.json(publicBillingCatalog(audience))
}

/** GET /api/payments/transactions */
export async function getTransactionsController(req: Request, res: Response): Promise<void> {
    const { user: { id: userId } } = req as AuthenticatedRequest
    const page  = Number(req.query.page)  || 1
    const limit = Number(req.query.limit) || 20
    const days = req.query.days ? Number(req.query.days) : undefined
    const type = req.query.type === "credit" || req.query.type === "debit" ? req.query.type : "all"
    const result = await getCreditTransactions(userId, page, limit, { days, type })
    res.json(result)
}
