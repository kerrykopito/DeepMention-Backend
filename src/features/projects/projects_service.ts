import prisma from "../../lib/prisma"
import { getAccessibleUserIds, getAssignedProjectIds } from '../../lib/agency_access'

export async function getUserProjects(user_id: string) {
    // For agency accounts this returns own projects + all active client projects.
    // For clients this includes projects explicitly assigned to them.
    const accessibleIds = await getAccessibleUserIds(user_id)
    const assignedProjectIds = await getAssignedProjectIds(user_id)

    return prisma.project.findMany({
        where: {
            OR: [
                { user_id: { in: accessibleIds } },
                { id: { in: assignedProjectIds } }
            ]
        },
        orderBy: { created_at: "asc" },
        include: {
            // Only the latest run (+ its scrape jobs) is used by the client, for the
            // "Today's run" status badge shown for every project on every page. Prompts,
            // competitors and engine preferences used to be embedded here too, but nothing
            // reads them from this endpoint anymore — each tab (Prompts, Competitors,
            // Settings) already fetches its own authoritative copy from its own endpoint.
            // Embedding them here duplicated that data and made this request, which runs
            // on every authenticated page load, needlessly heavy for every accessible project.
            runs: {
                take: 1,
                orderBy: { ran_at: "desc" },
                include: {
                    scrape_jobs: {
                        select: {
                            id: true,
                            engine: true,
                            status: true,
                            prompt_id: true,
                            completed_at: true,
                            created_at: true,
                            error_reason: true,
                            retry_count: true,
                            chat_id: true,
                            geo_country_code: true,
                            geo_city: true
                        },
                        orderBy: { created_at: "asc" }
                    }
                }
            }
        }
    })
}
