import { Request, Response } from "express"
import type { EmailAccount } from "@prisma/client"
import * as emailService from "./email_campaign_service"
import prisma from "../../../lib/prisma"
import { assertProjectAccess, assertProjectMutationAccess } from "../../projects/project_access"
import type { AuthenticatedRequest } from "../../../middleware/auth"

// SECURITY: The tenant is still selected via the `x-project-id` header, but the
// header value is no longer trusted on its own. Every handler now resolves the
// project through the central access layer, which verifies the authenticated
// user owns (or has agency access to) that project. This closes the cross-tenant
// IDOR where any authenticated user could target any project by forging the
// header. Read handlers use assertProjectAccess; mutating handlers use
// assertProjectMutationAccess (which also rejects read-only CLIENT_VIEWER links).
async function resolveProjectAccess(req: Request, mutation: boolean): Promise<string> {
    const projectId = req.headers["x-project-id"]
    if (typeof projectId !== "string" || !projectId) {
        throw Object.assign(new Error("Missing project ID"), { status: 400 })
    }
    const userId = (req as AuthenticatedRequest).user.id
    if (mutation) {
        await assertProjectMutationAccess(projectId, userId)
    } else {
        await assertProjectAccess(projectId, userId)
    }
    return projectId
}

function handleControllerError(error: any, res: Response) {
    if (error?.message === "PROJECT_NOT_FOUND") {
        return res.status(404).json({ error: "Project not found" })
    }
    if (typeof error?.status === "number") {
        return res.status(error.status).json({ error: error.message })
    }
    return res.status(500).json({ error: error?.message ?? "Internal error" })
}

// SECURITY: AWS SES credentials must never be returned to API clients. Expose
// only an explicit allow-list of non-secret configuration metadata; the stored
// keys stay server-side for the campaign processor to use. Building this as an
// allow-list (rather than deleting secret fields) means any future secret column
// is omitted by default instead of leaking.
function redactAccount(account: EmailAccount | null) {
    if (!account) return null
    return {
        id: account.id,
        project_id: account.project_id,
        user_id: account.user_id,
        provider: account.provider,
        from_name: account.from_name,
        from_email: account.from_email,
        reply_to_email: account.reply_to_email,
        is_verified: account.is_verified,
        aws_region: account.aws_region,
        created_at: account.created_at,
        updated_at: account.updated_at,
        configured: Boolean(account.aws_access_key && account.aws_secret_key)
    }
}

export async function createAccount(req: Request, res: Response) {
    try {
        const projectId = await resolveProjectAccess(req, true)
        const userId = (req as AuthenticatedRequest).user.id

        const { fromName, fromEmail, provider, awsRegion, awsAccessKey, awsSecretKey } = req.body

        // Check if account already exists
        // SECURITY TODO: aws_secret_key is persisted in plaintext. It should be
        // encrypted at rest (e.g. KMS/envelope encryption); no such utility exists
        // in this codebase yet, so this is left as a follow-up. The API no longer
        // returns the secret (see redactAccount).
        const existing = await prisma.emailAccount.findUnique({
            where: { project_id: projectId }
        })

        if (existing) {
            const updated = await prisma.emailAccount.update({
                where: { project_id: projectId },
                data: {
                    from_name: fromName,
                    from_email: fromEmail,
                    provider: provider || "AWS_SES",
                    aws_region: awsRegion,
                    aws_access_key: awsAccessKey,
                    aws_secret_key: awsSecretKey,
                    is_verified: true // Assume verified for now, or add SES verification logic later
                }
            })
            return res.json(redactAccount(updated))
        }

        const account = await prisma.emailAccount.create({
            data: {
                project_id: projectId,
                user_id: userId,
                from_name: fromName,
                from_email: fromEmail,
                provider: provider || "AWS_SES",
                aws_region: awsRegion,
                aws_access_key: awsAccessKey,
                aws_secret_key: awsSecretKey,
                is_verified: true
            }
        })

        res.json(redactAccount(account))
    } catch (error: any) {
        console.error("Create Email Account Error:", error)
        handleControllerError(error, res)
    }
}

export async function getAccount(req: Request, res: Response) {
    try {
        const projectId = await resolveProjectAccess(req, false)

        const account = await prisma.emailAccount.findUnique({
            where: { project_id: projectId }
        })

        res.json(redactAccount(account))
    } catch (error: any) {
        handleControllerError(error, res)
    }
}

export async function createCampaign(req: Request, res: Response) {
    try {
        const projectId = await resolveProjectAccess(req, true)
        const userId = (req as AuthenticatedRequest).user.id

        const account = await prisma.emailAccount.findUnique({ where: { project_id: projectId } })
        if (!account) return res.status(404).json({ error: "Email account not found" })

        const campaign = await emailService.createEmailCampaign(projectId, userId, {
            name: req.body.name,
            templateId: req.body.templateId,
            accountId: account.id
        })

        res.json(campaign)
    } catch (error: any) {
        handleControllerError(error, res)
    }
}

export async function listCampaigns(req: Request, res: Response) {
    try {
        const projectId = await resolveProjectAccess(req, false)
        const account = await prisma.emailAccount.findUnique({ where: { project_id: projectId } })
        if (!account) return res.json([])

        const campaigns = await emailService.listEmailCampaigns(account.id)
        res.json(campaigns)
    } catch (error: any) {
        handleControllerError(error, res)
    }
}

export async function getCampaign(req: Request, res: Response) {
    try {
        const projectId = await resolveProjectAccess(req, false)
        const campaign = await emailService.getEmailCampaign(req.params.id, projectId)
        // SECURITY: getEmailCampaign includes the account (with credentials) for the
        // ownership check; strip secrets before returning it to the client.
        res.json({ ...campaign, account: redactAccount(campaign.account) })
    } catch (error: any) {
        handleControllerError(error, res)
    }
}

export async function uploadRecipients(req: Request, res: Response) {
    try {
        const projectId = await resolveProjectAccess(req, true)
        const { csv } = req.body

        // Verify the campaign belongs to this (now authorized) project
        await emailService.getEmailCampaign(req.params.id, projectId)

        const count = await emailService.addRecipientsFromCsv(req.params.id, csv)
        res.json({ success: true, count })
    } catch (error: any) {
        handleControllerError(error, res)
    }
}

export async function launchCampaign(req: Request, res: Response) {
    try {
        const projectId = await resolveProjectAccess(req, true)
        await emailService.launchEmailCampaign(req.params.id, projectId)
        res.json({ success: true })
    } catch (error: any) {
        handleControllerError(error, res)
    }
}

export async function createTemplate(req: Request, res: Response) {
    try {
        const projectId = await resolveProjectAccess(req, true)
        const account = await prisma.emailAccount.findUnique({ where: { project_id: projectId } })
        if (!account) return res.status(404).json({ error: "Email account not found" })

        const template = await emailService.createEmailTemplate(account.id, {
            name: req.body.name,
            subject: req.body.subject,
            htmlBody: req.body.htmlBody,
            designJson: req.body.designJson
        })

        res.json(template)
    } catch (error: any) {
        handleControllerError(error, res)
    }
}

export async function listTemplates(req: Request, res: Response) {
    try {
        const projectId = await resolveProjectAccess(req, false)
        const account = await prisma.emailAccount.findUnique({ where: { project_id: projectId } })
        if (!account) return res.json([])

        const templates = await emailService.listEmailTemplates(account.id)
        res.json(templates)
    } catch (error: any) {
        handleControllerError(error, res)
    }
}
