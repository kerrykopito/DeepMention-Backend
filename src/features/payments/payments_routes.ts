import { Router } from "express"
import { requireAuth } from "../../middleware/auth"
import {
    getBalanceController,
    getCreditPacksController,
    getTransactionsController,
    getBillingCatalogController,
    createCreditPackCheckoutController,
} from "./payments_controller"

const router = Router()

router.get("/balance",        requireAuth, getBalanceController)
router.get("/packs",          requireAuth, getCreditPacksController)
router.post("/packs/checkout", requireAuth, createCreditPackCheckoutController)
router.get("/catalog",        requireAuth, getBillingCatalogController)
router.get("/transactions",   requireAuth, getTransactionsController)

export default router
