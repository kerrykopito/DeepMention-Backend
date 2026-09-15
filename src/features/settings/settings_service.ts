import bcrypt from "bcryptjs"
import prisma from "../../lib/prisma"
import { AccountType } from "@prisma/client"
import { httpError } from "../../lib/http_error"

export async function getSettings(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            is_verified: true,
            account_type: true,
            role: true,
            plan: true,
            created_at: true,
            updated_at: true,
        },
    })

    if (!user) {
        throw httpError(404, "User not found")
    }

    return {
        account: user,
        security: {
            password_enabled: true,
            email_verified: user.is_verified,
        },
        product: {
            weekly_email_reports: true,
            export_notifications: true,
        },
    }
}

export async function updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            password: true,
        },
    })

    if (!user) {
        throw httpError(404, "User not found")
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password)
    if (!validPassword) {
        throw httpError(400, "Current password is incorrect")
    }

    const reusedPassword = await bcrypt.compare(newPassword, user.password)
    if (reusedPassword) {
        throw httpError(400, "New password must be different from current password")
    }

    const salt = await bcrypt.genSalt(10)
    const password = await bcrypt.hash(newPassword, salt)

    await prisma.user.update({
        where: { id: userId },
        data: { password },
    })

    return { message: "Password updated successfully" }
}

// Every rejection this function raises states its own status, so the controller no longer
// has to recognise these three sentences to know which of them is a 404, which are
// conflicts, and which failures are actually the server's fault.
export async function updateAccountType(userId: string, accountType: AccountType) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { account_type: true } })
    if (!user) throw httpError(404, "User not found")
    if (user.account_type === accountType) return { account_type: accountType }
    if (user.account_type === AccountType.AGENCY) {
        throw httpError(409, "Agency accounts cannot be converted to individual accounts while shared workspace data exists")
    }
    const paidSubscription = await prisma.subscription.findFirst({
        where: { user_id: userId, plan: { not: "FREE" }, status: { in: ["ACTIVE", "PAST_DUE", "INCOMPLETE"] } },
        select: { id: true },
    })
    if (paidSubscription) throw httpError(409, "Cancel the active individual subscription before converting to an agency account")
    await prisma.user.update({ where: { id: userId }, data: { account_type: AccountType.AGENCY } })
    return { account_type: AccountType.AGENCY }
}
