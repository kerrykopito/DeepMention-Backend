import { Request, Response } from "express"
import type { AuthenticatedRequest } from "../../middleware/auth"
import { getProjectEngines, setProjectEngines } from "./project_engines_service"
import { assertProjectAccess } from "../projects/project_access"
import { SELECTABLE_PROJECT_ENGINES, getEngineLimitForPlan } from "./project_engine_policy"
import { getUserPlan } from "../subscription/subscription_service"

export async function getProjectEnginesController(req: Request, res: Response): Promise<void> {
    try {
        const projectId = req.params.project_id
        const userId = (req as AuthenticatedRequest).user.id
        await assertProjectAccess(projectId, userId)
        const plan = await getUserPlan(userId)
        const engines = await getProjectEngines(projectId)
        const limit = getEngineLimitForPlan(plan)
        res.status(200).json({
            engines,
            selectable: [...SELECTABLE_PROJECT_ENGINES],
            limit,
            plan,
        })
    } catch (error) {
        if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
            res.status(404).json({ error: "Project not found" })
            return
        }
        console.error("[project_engines_controller:load]", error)
        res.status(500).json({ error: "Failed to load AI engines" })
    }
}

export async function updateProjectEnginesController(req: Request, res: Response): Promise<void> {
    try {
        const projectId = req.params.project_id
        const userId = (req as AuthenticatedRequest).user.id
        const engines = await setProjectEngines(projectId, userId, req.body.engines)
        res.status(200).json({ engines })
    } catch (error) {
        if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
            res.status(404).json({ error: "Project not found" })
            return
        }

        const message = error instanceof Error ? error.message : ""
        if (message.includes("Select") || message.includes("plan")) {
            res.status(400).json({ error: message })
            return
        }
        console.error("[project_engines_controller:update]", error)
        res.status(500).json({ error: "Failed to update AI engines" })
    }
}
