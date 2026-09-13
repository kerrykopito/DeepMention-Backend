import type { Request, Response } from "express"
import type { AuthenticatedRequest } from "../../middleware/auth"
import { getProfileData } from "./profile_service"

export async function getProfileController(req: Request, res: Response): Promise<void> {
    try {
        const {
            user: { id: userId },
        } = req as AuthenticatedRequest

        const profile = await getProfileData(userId)
        res.status(200).json(profile)
    } catch (error) {
        if (error instanceof Error && error.message === "User not found") {
            res.status(404).json({ error: error.message })
            return
        }
        console.error("[profile_controller:getProfile]", error)
        res.status(500).json({ error: "Failed to get profile" })
    }
}
