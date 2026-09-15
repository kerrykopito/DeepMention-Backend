import { Engine } from "@prisma/client"
import prisma from "../../lib/prisma"
import { getEffectivePlanAccess } from "../subscription/entitlements"
import { PlanLimitError, TRIAL_ENGINE_LIMIT, planLabel } from "../subscription/plan_limits"
import { httpError } from "../../lib/http_error"
import { assertProjectMutationAccess } from "../projects/project_access"
import {
    DEFAULT_PROJECT_ENGINES,
    SELECTABLE_PROJECT_ENGINES,
    getEngineLimitForPlan,
    normalizeProjectEngines,
} from "./project_engine_policy"

// Validates the selection and holds it to the account's engine allowance: the trial cap while
// a trial is running, the plan's own cap afterwards.
export async function assertCanUseProjectEngines(userId: string, rawEngines: unknown) {
    const engines = normalizeProjectEngines(rawEngines)

    // An empty selection is a malformed request, not a server fault, so it carries its own
    // 400. The status travels with the error because the two controllers that call this used
    // to recognise it by the word "Select" appearing in the sentence.
    if (engines.length === 0) {
        throw httpError(400, "Select at least one AI engine.")
    }

    const access = await getEffectivePlanAccess(userId)
    // A trial engine cap is a product limit, so it is the same kind of rejection as the
    // workspace cap and travels the same way. Reaching the scrape endpoint it used to be
    // answered with a 500, since that controller looked for the words "plan can track".
    if (access.trial.active && engines.length > TRIAL_ENGINE_LIMIT) {
        throw new PlanLimitError(`Your free trial includes ${TRIAL_ENGINE_LIMIT} AI engines. Add a plan or credits to unlock all engines.`)
    }

    // Outside a trial the plan's own engine allowance applies. Nothing enforced this before,
    // so FREE's declared three was advertised by the quota endpoint and never checked.
    //
    // Unlike workspaces, prompts and competitors, credits do not lift this one. Those three
    // are quantities of tracking the account pays to run, so a wallet can fund more of them;
    // engine coverage is what distinguishes the tiers from each other, and letting a top-up
    // buy it would mean no reason to hold a plan at all.
    if (!access.trial.active) {
        const engineLimit = getEngineLimitForPlan(access.effective_plan)
        if (engines.length > engineLimit) {
            throw new PlanLimitError(
                `Your ${planLabel(access.effective_plan)} plan can track ${engineLimit} AI engine${engineLimit === 1 ? "" : "s"}. Upgrade to track more.`,
            )
        }
    }

    return engines
}


export async function setProjectEngines(projectId: string, userId: string, rawEngines: unknown) {
    // Changing which engines a project tracks is a mutation, and it costs credits on every
    // subsequent run - so it needs the write check, not the read one a viewer also passes.
    await assertProjectMutationAccess(projectId, userId)
    const engines = await assertCanUseProjectEngines(userId, rawEngines)

    await prisma.$transaction(async tx => {
        await tx.projectEnginePreference.upsert({
            where: { project_id_engine: { project_id: projectId, engine: Engine.CHATGPT } },
            create: { project_id: projectId, engine: Engine.CHATGPT, is_active: engines.includes(Engine.CHATGPT) },
            update: { is_active: engines.includes(Engine.CHATGPT) },
        })
        await tx.projectEnginePreference.upsert({
            where: { project_id_engine: { project_id: projectId, engine: Engine.GEMINI } },
            create: { project_id: projectId, engine: Engine.GEMINI, is_active: engines.includes(Engine.GEMINI) },
            update: { is_active: engines.includes(Engine.GEMINI) },
        })
        await tx.projectEnginePreference.upsert({
            where: { project_id_engine: { project_id: projectId, engine: Engine.PERPLEXITY } },
            create: { project_id: projectId, engine: Engine.PERPLEXITY, is_active: engines.includes(Engine.PERPLEXITY) },
            update: { is_active: engines.includes(Engine.PERPLEXITY) },
        })
        await tx.projectEnginePreference.upsert({
            where: { project_id_engine: { project_id: projectId, engine: Engine.GOOGLE_AI_MODE } },
            create: { project_id: projectId, engine: Engine.GOOGLE_AI_MODE, is_active: engines.includes(Engine.GOOGLE_AI_MODE) },
            update: { is_active: engines.includes(Engine.GOOGLE_AI_MODE) },
        })
        await tx.projectEnginePreference.upsert({
            where: { project_id_engine: { project_id: projectId, engine: Engine.COPILOT } },
            create: { project_id: projectId, engine: Engine.COPILOT, is_active: engines.includes(Engine.COPILOT) },
            update: { is_active: engines.includes(Engine.COPILOT) },
        })
    })

    return getProjectEngines(projectId)
}

export async function createDefaultProjectEngines(projectId: string, engines: Engine[] = [...DEFAULT_PROJECT_ENGINES]) {
    const selected = new Set(engines)
    await prisma.projectEnginePreference.createMany({
        data: SELECTABLE_PROJECT_ENGINES.map(engine => ({
            project_id: projectId,
            engine,
            is_active: selected.has(engine),
        })),
        skipDuplicates: true,
    })
}

export async function getProjectEngines(projectId: string): Promise<Engine[]> {
    const rows = await prisma.projectEnginePreference.findMany({
        where: {
            project_id: projectId,
            is_active: true,
            engine: { in: [...SELECTABLE_PROJECT_ENGINES] },
        },
        select: { engine: true },
        orderBy: { created_at: "asc" },
    })

    if (rows.length) return rows.map(row => row.engine)

    await createDefaultProjectEngines(projectId)
    return [...DEFAULT_PROJECT_ENGINES]
}
