import type { Request, Response } from "express"
import type { AuthenticatedRequest } from "../../middleware/auth"
import { getProfileData } from "./profile_service"
import { resolveErrorResponse } from "../../lib/http_error"

export async function getProfileController(req: Request, res: Response): Promise<void> {
    try {
        const {
            user: { id: userId },
        } = req as AuthenticatedRequest

        const profile = await getProfileData(userId)
        res.status(200).json(profile)
    } catch (error) {
        const { status, message, unexpected } = resolveErrorResponse(error, "Failed to get profile")
        if (unexpected) console.error("[profile_controller:getProfile]", error)
        res.status(status).json({ error: message })
    }
}
