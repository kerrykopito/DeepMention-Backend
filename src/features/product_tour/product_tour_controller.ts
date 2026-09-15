import type { Response } from "express"
import type { AuthenticatedRequest } from "../../middleware/auth"
import { completeProductTour, getProductTourStatus } from "./product_tour_service"
import { resolveErrorResponse } from "../../lib/http_error"

export async function getProductTourStatusController(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const status = await getProductTourStatus(req.user.id)
        res.status(200).json(status)
    } catch (error) {
        const { status: code, message, unexpected } = resolveErrorResponse(error, "Failed to load product tour status")
        if (unexpected) console.error("[product_tour_controller:getStatus]", error)
        res.status(code).json({ error: message })
    }
}

export async function completeProductTourController(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const status = await completeProductTour(req.user.id)
        res.status(200).json(status)
    } catch (error) {
        console.error("[product_tour_controller:complete]", error)
        res.status(500).json({ error: "Failed to update product tour status" })
    }
}

