import { Engine } from "@prisma/client"
import { Request, Response } from "express"
import { enqueueProjectRun, getScrapeRun } from "./scrape_orchestration_service"
import { assertProjectAccess, assertProjectMutationAccess } from "../projects/project_access"
import type { AuthenticatedRequest } from "../../middleware/auth"
import { isActiveScrapeEngine } from "./scrape_engine_policy"
import { assertCanUseProjectEngines } from "../project_engines/project_engines_service"
import prisma from "../../lib/prisma"
import { ensureSignupBonusCredits, getCreditBalance, getPromptRunCreditCost } from "../payments/credits_service"
import { getProjectEngines } from "../project_engines/project_engines_service"
import { isScrapingDisabled } from "./scrape_gate"
import { resolveErrorResponse } from "../../lib/http_error"

export const enqueueProjectRunController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (isScrapingDisabled()) {
            res.status(503).json({ error: "Scraping is temporarily disabled for all projects." })
            return
        }
        const { project_id, prompt_ids, engines, profile } = req.body

        if (!project_id) {
            res.status(400).json({ error: "project_id is required" })
            return
        }

        const userId = (req as AuthenticatedRequest).user.id
        await assertProjectMutationAccess(project_id, userId)
        const parsedEngines = Array.isArray(engines)
            ? engines.map((engine: string) => engine.toUpperCase()).filter((engine: string) => engine in Engine) as Engine[]
            : undefined

        if (Array.isArray(engines) && parsedEngines?.length !== engines.length) {
            res.status(400).json({ error: "One or more scrape engines are invalid." })
            return
        }

        if (parsedEngines?.some(engine => !isActiveScrapeEngine(engine))) {
            res.status(400).json({ error: "Google AI Overview is no longer a supported scrape engine. Use Google AI Mode instead." })
            return
        }

        if (parsedEngines?.length) {
            await assertCanUseProjectEngines(userId, parsedEngines)
        }

        const selectedPromptWhere = {
            project_id,
            is_active: true,
            status: "ACTIVE" as const,
            ...(Array.isArray(prompt_ids) && prompt_ids.length ? { id: { in: prompt_ids } } : {}),
        }
        const prompts = await prisma.prompt.findMany({
            where: selectedPromptWhere,
            select: { _count: { select: { geo_variants: { where: { is_active: true } } } } },
        })
        const selectedEngines = parsedEngines?.length ? parsedEngines : await getProjectEngines(project_id)
        const engineCount = selectedEngines.length
        const requestedJobs = prompts.reduce((total, prompt) => total + 1 + prompt._count.geo_variants, 0) * engineCount
        await ensureSignupBonusCredits(userId)
        const availableCredits = await getCreditBalance(userId)
        const unitCreditCost = await getPromptRunCreditCost(userId)
        const requiredCredits = requestedJobs * unitCreditCost
        if (requiredCredits > availableCredits) {
            res.status(402).json({ error: `Not enough credits: this run needs ${requiredCredits}, but your wallet has ${availableCredits}.` })
            return
        }

        const result = await enqueueProjectRun({
            project_id,
            prompt_ids: Array.isArray(prompt_ids) ? prompt_ids : undefined,
            engines: parsedEngines,
            profile: typeof profile === "string" ? profile : undefined
        })

        res.status(202).json(result)
    } catch (error) {
        // "plan can track" was a sentence no service throws any more, so the trial engine cap
        // - the one limit this endpoint can actually hit - fell through to a 500 with a
        // generic message. It is a PlanLimitError now, and the read-only and not-found
        // rejections from the access check carry their own statuses too.
        const { status, message, unexpected } = resolveErrorResponse(error, "Failed to enqueue scrape run")
        if (unexpected) {
            console.error("[scraping_controller:enqueueScrapeRun]", error)
        }
        res.status(status).json({ error: message })
    }
}

export const getScrapeRunController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { run_id } = req.params

        if (!run_id || Array.isArray(run_id)) {
            res.status(400).json({ error: "run_id is required" })
            return
        }

        const run = await getScrapeRun(run_id)

        if (!run) {
            res.status(404).json({ error: "Run not found" })
            return
        }

        await assertProjectAccess(run.project_id, (req as AuthenticatedRequest).user.id)

        res.status(200).json(run)
    } catch (error) {
        if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
            res.status(404).json({ error: "Run not found" })
            return
        }
        console.error("[scraping_controller:getScrapeRun]", error)
        res.status(500).json({ error: "Failed to get scrape run" })
    }
}
