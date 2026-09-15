import { Request, Response } from "express"
import type { AuthenticatedRequest } from "../../middleware/auth"
import { getProjectEngines, setProjectEngines } from "./project_engines_service"
import { assertProjectAccess } from "../projects/project_access"
import { SELECTABLE_PROJECT_ENGINES, getEngineLimitForPlan } from "./project_engine_policy"
import { getUserPlan } from "../subscription/subscription_service"
import { httpError, resolveErrorResponse } from "../../lib/http_error"

// Express types a route parameter as `string | string[]`, so passing it straight into a
// function expecting a string was a type error in both handlers here. It is also a real one:
// a duplicated parameter arrives as an array, and assertProjectAccess would then compare an
// array against an id and reject in a way the caller cannot act on.
function readProjectId(value: string | string[] | undefined): string {
    if (typeof value !== "string" || !value) throw httpError(400, "project_id is required")
    return value
}

export async function getProjectEnginesController(req: Request, res: Response): Promise<void> {
    try {
        const projectId = readProjectId(req.params.project_id)
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
        const { status, message, unexpected } = resolveErrorResponse(error, "Failed to load AI engines")
        if (unexpected) {
            console.error("[project_engines_controller:load]", error)
        }
        res.status(status).json({ error: message })
    }
}

export async function updateProjectEnginesController(req: Request, res: Response): Promise<void> {
    try {
        const projectId = readProjectId(req.params.project_id)
        const userId = (req as AuthenticatedRequest).user.id
        const engines = await setProjectEngines(projectId, userId, req.body.engines)
        res.status(200).json({ engines })
    } catch (error) {
        // Every rejection on this path - the project not existing, the caller having
        // read-only access, an empty selection, the trial engine cap - now states its own
        // status. Searching the message for "Select" or "plan" answered 500 to the read-only
        // rejection, whose sentence contains neither word.
        const { status, message, unexpected } = resolveErrorResponse(error, "Failed to update AI engines")
        if (unexpected) {
            console.error("[project_engines_controller:update]", error)
        }
        res.status(status).json({ error: message })
    }
}
