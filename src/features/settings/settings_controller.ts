import type { Request, Response } from "express"
import { z } from "zod"
import type { AuthenticatedRequest } from "../../middleware/auth"
import { getSettings, updateAccountType, updatePassword } from "./settings_service"
import { resolveErrorResponse } from "../../lib/http_error"

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
        const { status, message, unexpected } = resolveErrorResponse(error, "Failed to get settings")
        if (unexpected) console.error("[settings_controller:getSettings]", error)
        res.status(status).json({ error: message })
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
        // Every sentence this ladder compared is now thrown with its own status, so
        // rewording any of them can no longer turn a 400 into a 500.
        const { status, message, unexpected } = resolveErrorResponse(error, "Failed to update password")
        if (unexpected) console.error("[settings_controller:updatePassword]", error)
        res.status(status).json({ error: message })
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
        // The three sentences this used to compare against now arrive carrying 404 and 409
        // themselves, so rewording any of them cannot turn it into a server error.
        const { status, message, unexpected } = resolveErrorResponse(error, "Failed to update account type")
        if (unexpected) {
            console.error("[settings_controller:updateAccountType]", error)
        }
        res.status(status).json({ error: message })
    }
}
