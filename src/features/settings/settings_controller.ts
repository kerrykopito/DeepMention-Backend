import type { Request, Response } from "express"
import { z } from "zod"
import type { AuthenticatedRequest } from "../../middleware/auth"
import { getSettings, updateAccountType, updatePassword } from "./settings_service"

const passwordSchema = z.object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
})

const accountTypeSchema = z.object({ account_type: z.enum(["SINGLE", "AGENCY"]) })

export async function getSettingsController(req: Request, res: Response): Promise<void> {
    try {
        const {
            user: { id: userId },
        } = req as AuthenticatedRequest

        res.status(200).json(await getSettings(userId))
    } catch (error) {
        if (error instanceof Error && error.message === "User not found") {
            res.status(404).json({ error: error.message })
            return
        }
        console.error("[settings_controller:getSettings]", error)
        res.status(500).json({ error: "Failed to get settings" })
    }
}

export async function updatePasswordController(req: Request, res: Response): Promise<void> {
    const parsed = passwordSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid password payload",
            errors: parsed.error.flatten().fieldErrors,
        })
        return
    }

    try {
        const {
            user: { id: userId },
        } = req as AuthenticatedRequest

        const result = await updatePassword(
            userId,
            parsed.data.current_password,
            parsed.data.new_password,
        )

        res.status(200).json(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update password"
        const statusCode =
            message === "User not found" ? 404 :
            message === "Current password is incorrect" ? 400 :
            message === "New password must be different from current password" ? 400 :
            500

        if (statusCode === 500) {
            console.error("[settings_controller:updatePassword]", error)
            res.status(500).json({ error: "Failed to update password" })
            return
        }
        res.status(statusCode).json({ error: message })
    }
}

export async function updateAccountTypeController(req: Request, res: Response): Promise<void> {
    const parsed = accountTypeSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ error: "account_type must be SINGLE or AGENCY" })
        return
    }
    try {
        const { user: { id: userId } } = req as AuthenticatedRequest
        res.status(200).json(await updateAccountType(userId, parsed.data.account_type))
    } catch (error) {
        const message = error instanceof Error ? error.message : ""
        if (message === "User not found") {
            res.status(404).json({ error: message })
            return
        }
        if (message === "Agency accounts cannot be converted to individual accounts while shared workspace data exists"
            || message === "Cancel the active individual subscription before converting to an agency account") {
            res.status(409).json({ error: message })
            return
        }
        console.error("[settings_controller:updateAccountType]", error)
        res.status(500).json({ error: "Failed to update account type" })
    }
}
