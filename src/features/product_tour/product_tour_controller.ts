import type { Response } from "express"
import type { AuthenticatedRequest } from "../../middleware/auth"
import { completeProductTour, getProductTourStatus } from "./product_tour_service"

export async function getProductTourStatusController(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const status = await getProductTourStatus(req.user.id)
        res.status(200).json(status)
    } catch (error) {
        if (error instanceof Error && error.message === "User not found") {
            res.status(404).json({ error: error.message })
            return
        }
        console.error("[product_tour_controller:getStatus]", error)
        res.status(500).json({ error: "Failed to load product tour status" })
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

