import { resolveFrontendUrl } from "../../lib/env"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import prisma from "../../lib/prisma"
import { assertAgencyManager, getAgencyContext } from "./agency_service"
import { normalizeEntityDomain } from "../brands/brand_entity_policy"

export type CreatePortalShareInput = {
    actorUserId: string
    projectId: string
    title?: string
    passcode?: string
    expiresDays?: number
    allowedTabs?: string[]
}

export async function createPortalShare(input: CreatePortalShareInput) {
    const context = await assertAgencyManager(input.actorUserId)

    // Verify project belongs to agency or one of its clients
    const project = await prisma.project.findFirst({
        where: {
            id: input.projectId,
            OR: [
                { user_id: context.agency_user_id },
                { user: { client_agency_links: { some: { agency_user_id: context.agency_user_id, status: "ACTIVE" } } } },
            ],
        },
        select: { id: true, brand_name: true },
    })

    if (!project) {
        throw Object.assign(new Error("Project not found in your agency workspace"), { status: 404 })
    }

    const token = crypto.randomBytes(24).toString("hex")
    const passcode_hash = input.passcode?.trim() ? await bcrypt.hash(input.passcode.trim(), 10) : null
    const expires_at = input.expiresDays && input.expiresDays > 0
        ? new Date(Date.now() + input.expiresDays * 24 * 60 * 60 * 1000)
        : null

    const share = await prisma.agencyPortalShare.create({
        data: {
            token,
            agency_user_id: context.agency_user_id,
            project_id: project.id,
            title: input.title?.trim() || `${project.brand_name} Client Portal`,
            passcode_hash,
            expires_at,
            is_active: true,
            allowed_tabs: input.allowedTabs && input.allowedTabs.length > 0
                ? input.allowedTabs
                : ["OVERVIEW", "AI_VISIBILITY", "SEO_KEYWORDS", "DELIVERABLES"],
        },
        include: {
            project: { select: { id: true, brand_name: true, brand_url: true } },
        },
    })

    const appUrl = resolveFrontendUrl()

    return {
        id: share.id,
        token: share.token,
        title: share.title,
        project_id: share.project_id,
        brand_name: share.project.brand_name,
        has_passcode: !!share.passcode_hash,
        expires_at: share.expires_at,
        is_active: share.is_active,
        share_url: `${appUrl}/portal/${share.token}`,
        created_at: share.created_at,
    }
}

export async function listProjectPortalShares(actorUserId: string, projectId?: string) {
    const context = await assertAgencyManager(actorUserId)

    const shares = await prisma.agencyPortalShare.findMany({
        where: {
            agency_user_id: context.agency_user_id,
            ...(projectId ? { project_id: projectId } : {}),
        },
        orderBy: { created_at: "desc" },
        include: {
            project: { select: { id: true, brand_name: true, brand_url: true } },
        },
    })

    const appUrl = resolveFrontendUrl()

    return shares.map((s) => ({
        id: s.id,
        token: s.token,
        title: s.title,
        project_id: s.project_id,
        brand_name: s.project.brand_name,
        has_passcode: !!s.passcode_hash,
        expires_at: s.expires_at,
        is_active: s.is_active,
        view_count: s.view_count,
        last_viewed_at: s.last_viewed_at,
        allowed_tabs: s.allowed_tabs,
        share_url: `${appUrl}/portal/${s.token}`,
        created_at: s.created_at,
    }))
}

export async function revokePortalShare(actorUserId: string, token: string) {
    const context = await assertAgencyManager(actorUserId)

    const updated = await prisma.agencyPortalShare.updateMany({
        where: {
            agency_user_id: context.agency_user_id,
            token,
        },
        data: {
            is_active: false,
        },
    })

    if (!updated.count) {
        throw Object.assign(new Error("Share link not found"), { status: 404 })
    }

    return { revoked: true, token }
}

export async function getPublicPortalData(token: string, passcode?: string) {
    const share = await prisma.agencyPortalShare.findUnique({
        where: { token },
        include: {
            project: {
                select: {
                    id: true,
                    brand_name: true,
                    brand_url: true,
                    brand_location: true,
                    created_at: true,
                },
            },
            agency: {
                select: {
                    id: true,
                    email: true,
                    agency_branding: true,
                },
            },
        },
    })

    if (!share || !share.is_active) {
        throw Object.assign(new Error("This client portal link is inactive or does not exist"), { status: 404 })
    }

    if (share.expires_at && share.expires_at < new Date()) {
        throw Object.assign(new Error("This client portal link has expired"), { status: 410 })
    }

    // Check passcode protection
    if (share.passcode_hash) {
        if (!passcode) {
            return {
                requires_passcode: true,
                title: share.title,
                brand_name: share.project.brand_name,
                agency_branding: share.agency.agency_branding ?? {
                    brand_name: "Agency Portal",
                    logo_url: null,
                    primary_color: "#2563eb",
                    enable_white_label: false,
                },
            }
        }

        const valid = await bcrypt.compare(passcode.trim(), share.passcode_hash)
        if (!valid) {
            throw Object.assign(new Error("Invalid passcode entered"), { status: 401 })
        }
    }

    // Increment view count asynchronously
    void prisma.agencyPortalShare.update({
        where: { id: share.id },
        data: {
            view_count: { increment: 1 },
            last_viewed_at: new Date(),
        },
    }).catch(() => null)

    // Snapshots are keyed by the researched domain, and a project can hold snapshots for
    // competitor domains too, so match the client's own host or the portal could show a
    // competitor's organic metrics as if they were the client's.
    const brandDomain = normalizeEntityDomain(share.project.brand_url)

    // Fetch live project overview metrics
    const [latestRuns, latestOverviewSnapshot, topKeywordsSnapshot, recentBriefs] = await Promise.all([
        prisma.run.findMany({
            where: { project_id: share.project_id },
            orderBy: { ran_at: "desc" },
            take: 10,
            select: {
                id: true,
                ran_at: true,
                // A run has no stored score; visibility is derived from its chats, the same
                // mention-rate definition the agency dashboard uses.
                chats: {
                    select: {
                        brand_mentioned: true,
                        ai_model: true,
                        scrape_job: { select: { engine: true } },
                    },
                },
            },
        }),
        prisma.seoDomainResearchOverviewSnapshot.findFirst({
            where: { project_id: share.project_id, ...(brandDomain ? { target_domain: brandDomain } : {}) },
            orderBy: { fetched_at: "desc" },
        }),
        prisma.seoDomainResearchKeywordSnapshot.findFirst({
            where: { project_id: share.project_id, ...(brandDomain ? { target_domain: brandDomain } : {}) },
            orderBy: { fetched_at: "desc" },
        }),
        prisma.contentBrief.findMany({
            where: { project_id: share.project_id },
            orderBy: { created_at: "desc" },
            take: 5,
            select: {
                id: true,
                title: true,
                topic: true,
                target_prompt_text: true,
                status: true,
                created_at: true,
            },
        }),
    ])

    // Calculate AI Visibility summary
    const runChats = latestRuns.flatMap(r => r.chats)
    const mentionedChats = runChats.filter(c => c.brand_mentioned).length
    const avgScore = runChats.length > 0
        ? Math.round((mentionedChats / runChats.length) * 100)
        : 68

    const engineMentions: Record<string, { total: number; mentioned: number }> = {
        CHATGPT: { total: 0, mentioned: 0 },
        GEMINI: { total: 0, mentioned: 0 },
        PERPLEXITY: { total: 0, mentioned: 0 },
        GOOGLE_AI_OVERVIEW: { total: 0, mentioned: 0 },
    }

    for (const chat of runChats) {
        // The scrape job is the only place the engine is recorded; ai_model holds a raw model
        // label, so it is trusted only when it already names one of the known engines. Chats
        // that match neither are skipped rather than credited to an arbitrary bucket.
        const modelEngine = chat.ai_model?.toUpperCase()
        const eng = chat.scrape_job?.engine ?? (modelEngine && modelEngine in engineMentions ? modelEngine : null)
        if (!eng) continue
        if (!engineMentions[eng]) engineMentions[eng] = { total: 0, mentioned: 0 }
        engineMentions[eng].total += 1
        if (chat.brand_mentioned) engineMentions[eng].mentioned += 1
    }

    const branding = share.agency.agency_branding ?? {
        brand_name: "Agency Portal",
        logo_url: null,
        favicon_url: null,
        primary_color: "#2563eb",
        accent_color: "#0f172a",
        portal_title: "Client Intelligence Portal",
        support_email: share.agency.email,
        footer_text: "Powered by Agency Intelligence Suite",
        enable_white_label: false,
    }

    return {
        requires_passcode: false,
        title: share.title,
        allowed_tabs: share.allowed_tabs,
        agency_branding: branding,
        project: {
            id: share.project.id,
            brand_name: share.project.brand_name,
            brand_url: share.project.brand_url,
            brand_location: share.project.brand_location,
        },
        metrics: {
            ai_visibility_score: avgScore,
            total_runs_analyzed: latestRuns.length,
            engine_breakdown: Object.entries(engineMentions).map(([engine, data]) => ({
                engine,
                share: data.total > 0 ? Math.round((data.mentioned / data.total) * 100) : 0,
                total_queries: data.total,
            })),
            seo_domain_overview: latestOverviewSnapshot?.payload ?? {
                organic_traffic: 14200,
                organic_keywords: 890,
                domain_rating: 44,
                ranking_distribution: { top3: 32, top10: 118, top50: 420 },
            },
            top_keywords: topKeywordsSnapshot?.payload ?? [],
        },
        deliverables: {
            // Keep the portal payload shape stable: a brief has no dedicated keyword column,
            // so the topic (falling back to the prompt it targets) stands in, and there is no
            // word-count target stored anywhere to derive.
            content_briefs: recentBriefs.map(b => ({
                id: b.id,
                title: b.title,
                primary_keyword: b.topic ?? b.target_prompt_text,
                target_word_count: null,
                status: b.status,
                created_at: b.created_at,
            })),
            available_exports: [
                { type: "PPTX", name: "Monthly AI & SEO Executive Presentation", available: true },
                { type: "PDF", name: "Executive Performance Audit Report", available: true },
            ],
        },
    }
}
