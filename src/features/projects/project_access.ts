import { AGENCY_STAFF_WRITE_ROLES, canWriteToProject } from "./project_write_policy"
import {
    assertAgencyProjectAccess,
    assertAgencyCompetitorAccess,
    assertAgencyRunAccess,
    assertAgencyPromptAccess,
} from "../../lib/agency_access"

export async function assertProjectAccess(project_id: string, user_id: string) {
    const project = await assertAgencyProjectAccess(project_id, user_id)
    if (!project) {
        throw new Error("PROJECT_NOT_FOUND")
    }
    return project
}

export async function assertProjectMutationAccess(project_id: string, user_id: string) {
    const project = await assertProjectAccess(project_id, user_id)
    if (project.user_id === user_id) return project

    const prismaClient = (await import("../../lib/prisma")).default

    // None of the three feeds another, so they resolve together rather than in sequence.
    const [clientSeat, ownerIsMyClient, memberships] = await Promise.all([
        // D: the project belongs to an agency the caller is a client of.
        prismaClient.agencyClientLink.findFirst({
            where: { agency_user_id: project.user_id, client_user_id: user_id, status: 'ACTIVE' },
            select: { role: true },
        }),
        // A: the caller is an agency and the project's owner is one of its clients.
        prismaClient.agencyClientLink.findFirst({
            where: { agency_user_id: user_id, client_user_id: project.user_id, status: 'ACTIVE' },
            select: { id: true },
        }),
        // B and C: the agencies the caller is active staff of.
        prismaClient.agencyMembership.findMany({
            where: { member_user_id: user_id, status: 'ACTIVE' },
            select: { agency_user_id: true, role: true },
        }),
    ])

    const staffAgencyIds = memberships
        .filter(membership => AGENCY_STAFF_WRITE_ROLES.has(membership.role))
        .map(membership => membership.agency_user_id)

    // Only asked when the caller is staff somewhere, so the common case pays nothing for it.
    const staffOfAgencyOwningClient = staffAgencyIds.length > 0
        ? Boolean(await prismaClient.agencyClientLink.findFirst({
            where: { agency_user_id: { in: staffAgencyIds }, client_user_id: project.user_id, status: 'ACTIVE' },
            select: { id: true },
        }))
        : false

    const allowed = canWriteToProject({
        is_owner: false,
        owner_is_my_client: Boolean(ownerIsMyClient),
        staff_of_owning_agency: staffAgencyIds.includes(project.user_id),
        staff_of_agency_owning_client: staffOfAgencyOwningClient,
        client_seat_role: clientSeat?.role ?? null,
    })

    if (!allowed) {
        throw Object.assign(
            new Error("Read-only access: this account cannot modify projects or prompts in this workspace."),
            { status: 403 },
        )
    }

    return project
}

export async function assertCompetitorAccess(competitor_id: string, user_id: string) {
    const competitor = await assertAgencyCompetitorAccess(competitor_id, user_id)
    if (!competitor) {
        throw new Error("COMPETITOR_NOT_FOUND")
    }
    return competitor
}

export async function assertCompetitorMutationAccess(competitor_id: string, user_id: string) {
    const competitor = await assertCompetitorAccess(competitor_id, user_id)
    const prismaClient = (await import("../../lib/prisma")).default
    const project = await prismaClient.project.findUnique({ where: { id: competitor.project_id } })
    if (project) await assertProjectMutationAccess(project.id, user_id)
    return competitor
}

export async function assertRunAccess(run_id: string, user_id: string) {
    const run = await assertAgencyRunAccess(run_id, user_id)
    if (!run) {
        throw new Error("RUN_NOT_FOUND")
    }
    return run
}

export async function assertPromptAccess(prompt_id: string, user_id: string) {
    const prompt = await assertAgencyPromptAccess(prompt_id, user_id)
    if (!prompt) {
        throw new Error("PROMPT_NOT_FOUND")
    }
    return prompt
}

export async function assertPromptMutationAccess(prompt_id: string, user_id: string) {
    const prompt = await assertPromptAccess(prompt_id, user_id)
    await assertProjectMutationAccess(prompt.project_id, user_id)
    return prompt
}
