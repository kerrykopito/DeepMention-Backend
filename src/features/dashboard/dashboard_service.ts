import prisma from "../../lib/prisma"
import { Prisma } from '@prisma/client'
import { analyzeResponse } from "../llm/gemini_service"
import type { RunPromptInput, DashboardDataInput } from "./dashboard_types"
import { enqueueSourceEnrichment } from "../../queues/source_enrichment_queue"
import { normalizeAnswerBlocks } from "./answer_block_normalizer"
import { normalizeEntityDomain } from "../brands/brand_entity_policy"

// The source table is a top-N list, but the query used to return every domain a project has
// ever cited: a year of one project is ~400k source rows over thousands of domains, all of it
// serialised to the browser to render a handful of bars.
const TOP_SOURCES_LIMIT = 100

export interface DashboardFilters {
    days?: number
    model?: string
    topic?: string
    tag?: string
    prompt_id?: string
    q?: string
    country?: string
    intent?: string
    mentioned?: boolean
    cited?: boolean
}

export function buildChatWhere(project_id: string, filters: DashboardFilters): Prisma.ChatWhereInput {
    const where: Prisma.ChatWhereInput = {
        prompt: { project_id }
    }
    
    if (filters.days) {
        where.created_at = { gte: new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000) }
    }
    
    if (filters.model && filters.model !== 'all') {
        // Handle variations (e.g. ChatGPT could be chatgpt, openai, etc. The DB stores what we save. Typically ChatGPT, Gemini, Perplexity)
        where.ai_model = { contains: filters.model, mode: 'insensitive' }
    }

    if (filters.country && filters.country !== 'all') {
        where.AND = [
            ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
            {
                OR: [
                    { geo_country_code: filters.country },
                    { geo_country_name: { equals: filters.country, mode: 'insensitive' } },
                ],
            },
        ]
    }

    if (typeof filters.mentioned === 'boolean') {
        where.brand_mentioned = filters.mentioned
    }

    if (filters.cited === true) {
        where.sources = { some: { is_cited: true } }
    } else if (filters.cited === false) {
        where.sources = { none: { is_cited: true } }
    }
    
    const promptWhere: Prisma.PromptWhereInput = { project_id }
    let hasPromptFilter = false
    
    if (filters.topic && filters.topic !== 'all') {
        promptWhere.topic = filters.topic
        hasPromptFilter = true
    }

    if (filters.intent && filters.intent !== 'all') {
        promptWhere.type = filters.intent
        hasPromptFilter = true
    }
    
    if (filters.tag && filters.tag !== 'all') {
        promptWhere.tags = { has: filters.tag }
        hasPromptFilter = true
    }
    
    if (filters.prompt_id) {
        promptWhere.id = filters.prompt_id
        hasPromptFilter = true
    }
    
    if (hasPromptFilter) {
        where.prompt = promptWhere
    }

    const q = filters.q?.trim()
    if (q) {
        const searchCondition: Prisma.ChatWhereInput = {
          OR: [
            { raw_response: { contains: q, mode: 'insensitive' } },
            { prompt: { text: { contains: q, mode: 'insensitive' } } },
            { brand_mentions: { some: { brand_name: { contains: q, mode: 'insensitive' } } } },
            { sources: { some: { domain: { contains: q, mode: 'insensitive' } } } },
            { sources: { some: { title: { contains: q, mode: 'insensitive' } } } }
          ],
        }
        where.AND = [
          ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
          searchCondition,
        ]
    }
    
    return where
}

/**
 * SQL twin of buildChatWhere, for the aggregations Prisma cannot express
 * (COUNT(DISTINCT ...), date_trunc bucketing, "oldest half of the chats").
 *
 * Every branch here mirrors one branch of buildChatWhere and they must be edited in
 * lockstep: a raw query that quietly drops a filter returns numbers that look plausible
 * and are wrong, which is worse than a slow query. The caller is responsible for aliasing
 * Chat as "c" and Prompt as "p"; the fragment is a bare boolean expression so it can be
 * dropped into any WHERE clause.
 */
function buildChatWhereSql(project_id: string, filters: DashboardFilters): Prisma.Sql {
    const conditions: Prisma.Sql[] = [Prisma.sql`p.project_id = ${project_id}`]

    if (filters.days) {
        // created_at is "timestamp without time zone" holding UTC. A JS Date would be
        // serialised by the driver in the client's local zone and silently shift the
        // window by the offset, so pass the UTC wall time and cast it explicitly.
        const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString()
        conditions.push(Prisma.sql`c.created_at >= ${since}::timestamp`)
    }

    if (filters.model && filters.model !== 'all') {
        conditions.push(Prisma.sql`c.ai_model ILIKE '%' || ${filters.model} || '%'`)
    }

    if (filters.country && filters.country !== 'all') {
        conditions.push(Prisma.sql`(c.geo_country_code = ${filters.country} OR c.geo_country_name ILIKE ${filters.country})`)
    }

    if (typeof filters.mentioned === 'boolean') {
        conditions.push(Prisma.sql`c.brand_mentioned = ${filters.mentioned}`)
    }

    if (filters.cited === true) {
        conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "Source" cited WHERE cited.chat_id = c.id AND cited.is_cited)`)
    } else if (filters.cited === false) {
        conditions.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "Source" cited WHERE cited.chat_id = c.id AND cited.is_cited)`)
    }

    if (filters.topic && filters.topic !== 'all') {
        conditions.push(Prisma.sql`p.topic = ${filters.topic}`)
    }

    if (filters.intent && filters.intent !== 'all') {
        conditions.push(Prisma.sql`p.type = ${filters.intent}`)
    }

    if (filters.tag && filters.tag !== 'all') {
        conditions.push(Prisma.sql`${filters.tag}::text = ANY(p.tags)`)
    }

    if (filters.prompt_id) {
        conditions.push(Prisma.sql`p.id = ${filters.prompt_id}`)
    }

    const q = filters.q?.trim()
    if (q) {
        conditions.push(Prisma.sql`(
            c.raw_response ILIKE '%' || ${q} || '%'
            OR p.text ILIKE '%' || ${q} || '%'
            OR EXISTS (SELECT 1 FROM "BrandMention" hit WHERE hit.chat_id = c.id AND hit.brand_name ILIKE '%' || ${q} || '%')
            OR EXISTS (SELECT 1 FROM "Source" hit WHERE hit.chat_id = c.id AND hit.domain ILIKE '%' || ${q} || '%')
            OR EXISTS (SELECT 1 FROM "Source" hit WHERE hit.chat_id = c.id AND hit.title ILIKE '%' || ${q} || '%')
        )`)
    }

    return Prisma.join(conditions, ' AND ')
}

function previousPeriodFilters(filters: DashboardFilters): DashboardFilters | null {
    if (!filters.days) return null

    return {
        ...filters,
        days: undefined
    }
}

function previousPeriodDateWhere(filters: DashboardFilters) {
    if (!filters.days) return undefined

    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    return {
        gte: new Date(now - filters.days * 2 * dayMs),
        lt: new Date(now - filters.days * dayMs)
    }
}

function deltaValue(current: number | null, previous: number | null, lowerIsBetter = false) {
    if (current === null || previous === null) return null
    const diff = current - previous
    return lowerIsBetter ? -diff : diff
}

interface OwnBrandStats {
    visibility: number | null
    avg_position: number | null
    avg_sentiment: number | null
}

/**
 * Own-brand headline numbers, grouped by brand_mentioned so one round trip yields both the
 * denominator (every matching chat) and the numerator (the mentioning ones). Position and
 * sentiment are averaged over the mentioning chats only, and SQL AVG skips NULLs, which is
 * what the old in-memory version did by filtering before it divided.
 */
async function ownBrandStats(where: Prisma.ChatWhereInput): Promise<{ total: number } & OwnBrandStats> {
    const groups = await prisma.chat.groupBy({
        by: ['brand_mentioned'],
        where,
        _count: { _all: true },
        _avg: { brand_position: true, sentiment_score: true },
    })

    const total = groups.reduce((acc, group) => acc + group._count._all, 0)
    if (total === 0) {
        return { total: 0, visibility: null, avg_position: null, avg_sentiment: null }
    }

    const mentioned = groups.find(group => group.brand_mentioned)
    return {
        total,
        visibility: ((mentioned?._count._all ?? 0) / total) * 100,
        avg_position: mentioned?._avg.brand_position ?? null,
        avg_sentiment: mentioned?._avg.sentiment_score ?? null
    }
}

/**
 * Without a date filter the dashboard compares the newer half of the history against the
 * older half, so "previous" is the oldest floor(n/2) chats. Prisma can neither apply a row
 * limit before aggregating nor count a filtered subset, hence the raw form.
 */
async function previousAllTimeBrandStats(project_id: string, filters: DashboardFilters, midpoint: number): Promise<OwnBrandStats> {
    if (midpoint <= 0) {
        return { visibility: null, avg_position: null, avg_sentiment: null }
    }

    const chatWhereSql = buildChatWhereSql(project_id, filters)
    const [row] = await prisma.$queryRaw<Array<{ total: number, mentioned: number, avg_position: number | null, avg_sentiment: number | null }>>`
        SELECT
            COUNT(*)::int AS total,
            (COUNT(*) FILTER (WHERE oldest.brand_mentioned))::int AS mentioned,
            (AVG(oldest.brand_position) FILTER (WHERE oldest.brand_mentioned))::float8 AS avg_position,
            (AVG(oldest.sentiment_score) FILTER (WHERE oldest.brand_mentioned))::float8 AS avg_sentiment
        FROM (
            SELECT c.brand_mentioned, c.brand_position, c.sentiment_score
            FROM "Chat" c
            JOIN "Prompt" p ON p.id = c.prompt_id
            WHERE ${chatWhereSql}
            ORDER BY c.created_at ASC
            LIMIT ${midpoint}
        ) oldest
    `

    if (!row || row.total === 0) {
        return { visibility: null, avg_position: null, avg_sentiment: null }
    }

    return {
        visibility: (row.mentioned / row.total) * 100,
        avg_position: row.avg_position,
        avg_sentiment: row.avg_sentiment
    }
}

export async function getFilterOptions(project_id: string) {
    const prompts = await prisma.prompt.findMany({
        where: { project_id },
        select: { topic: true, tags: true, type: true }
    })

    const topics = Array.from(new Set(prompts.map(p => p.topic).filter(Boolean)))
    const tags = Array.from(new Set(prompts.flatMap(p => p.tags).filter(Boolean)))
    const intents = Array.from(new Set(prompts.map(p => p.type).filter(Boolean)))
    // The country list is at most a handful of rows, but it used to be distilled from every
    // chat the project has ever produced. groupBy is the same set of pairs, collapsed by
    // Postgres instead of by streaming the history into this process.
    const chats = await prisma.chat.groupBy({
        by: ['geo_country_code', 'geo_country_name'],
        where: { prompt: { project_id } },
        orderBy: [{ geo_country_code: 'asc' }, { geo_country_name: 'asc' }],
    })
    const countries = chats
        .map(chat => ({ value: chat.geo_country_code || chat.geo_country_name || '', label: chat.geo_country_name || chat.geo_country_code || '' }))
        .filter(country => country.value && country.label)
        .sort((a, b) => a.label.localeCompare(b.label))

    return { topics, tags, intents, countries }
}

export async function runPrompt(input: RunPromptInput) {
    const { 
        prompt_id, run_id, raw_response, ai_model, screenshot_path, citations,
        geo_variant_id, geo_country_code, geo_country_name, geo_city
    } = input

    const prompt = await prisma.prompt.findUniqueOrThrow({
        where: { id: prompt_id },
        include: { project: true }
    })

    const analysis = await analyzeResponse(
        raw_response,
        ai_model,
        prompt.project.brand_name,
        prompt.project.brand_url,
        citations ?? []
    )

    const sourceRows = buildSourceRows(analysis.sources, citations ?? [])

    const chat = await prisma.chat.create({
        data: {
            run_id,
            prompt_id,
            geo_variant_id: geo_variant_id ?? null,
            geo_country_code: geo_country_code ?? null,
            geo_country_name: geo_country_name ?? null,
            geo_city: geo_city ?? null,
            ai_model,
            raw_response,  // always keep original scraper dump as truth
            display_response: null,
            answer_blocks: normalizeAnswerBlocks(
                raw_response,
                analysis.brand_mentions.map(mention => mention.brand_name)
            ),
            screenshot_path: screenshot_path ?? null,
            brand_mentioned: analysis.brand_mentioned,
            brand_position: analysis.brand_position ?? null,
            sentiment_score: analysis.sentiment_score ?? null,
            brand_mentions: {
                create: analysis.brand_mentions.map(m => ({
                    brand_name: m.brand_name,
                    domain: m.domain ?? null,  // persist the real domain (peec.ai, profound.ai etc.)
                    position: m.position ?? null,
                    sentiment_score: m.sentiment_score ?? null
                }))
            },
            sources: {
                create: sourceRows
            }
        },
        include: {
            brand_mentions: true,
            sources: true
        }
    })

    if (input.enqueue_source_enrichment !== false && process.env.SOURCE_ENRICHMENT_AUTO_ENQUEUE !== "false") {
        try {
            const maxSources = Math.max(0, Number(process.env.SOURCE_ENRICHMENT_MAX_PER_CHAT ?? 8))
            const sources = maxSources > 0
                ? await prisma.source.findMany({
                    where: {
                        chat_id: chat.id,
                        url: { not: "" },
                        source_url_content_id: null,
                    },
                    select: { id: true },
                    orderBy: [
                        { is_cited: "desc" },
                        { created_at: "asc" },
                    ],
                    take: maxSources,
                })
                : []

            const queued = await Promise.allSettled(
                sources.map((source, index) => enqueueSourceEnrichment(source.id, index * 1000))
            )

            const failed = queued.filter(result => result.status === "rejected").length
            if (failed > 0) {
                console.warn("Some source enrichment jobs could not be queued", {
                    chat_id: chat.id,
                    failed,
                    total: queued.length,
                })
            }
        } catch (error) {
            console.warn("Source enrichment enqueue skipped", {
                chat_id: chat.id,
                error: error instanceof Error ? error.message : error,
            })
        }
    }

    return chat
}

function buildSourceRows(
    analysisSources: {
        url: string
        domain: string
        source_type: 'EDITORIAL' | 'CORPORATE' | 'UGC' | 'SOCIAL' | 'COMPETITOR' | 'YOU' | 'REFERENCE' | 'INSTITUTIONAL' | 'OTHER'
        is_cited: boolean
    }[],
    citations: {
        text: string
        url: string
        domain?: string | null
        snippet?: string | null
        position?: number | null
        answer_position?: number | null
        is_cited?: boolean
        source_kind?: string | null
    }[]
) {
    const rows: {
        url: string
        domain: string
        source_type: 'EDITORIAL' | 'CORPORATE' | 'UGC' | 'SOCIAL' | 'COMPETITOR' | 'YOU' | 'REFERENCE' | 'INSTITUTIONAL' | 'OTHER'
        url_type?: 'LISTICLE' | 'COMPARISON' | 'DISCUSSION' | 'ARTICLE' | 'DOCUMENTATION' | 'REVIEW' | 'SOCIAL_POST' | 'HOMEPAGE' | 'OTHER'
        is_cited: boolean
        used_by_ai?: boolean
        title?: string | null
        snippet?: string | null
        source_kind?: string | null
        source_position?: number | null
        answer_position?: number | null
    }[] = []
    const byKey = new Map<string, typeof rows[number]>()

    for (const source of analysisSources) {
        const url = source.url?.trim()
        const domain = source.domain?.trim() || safeDomain(url)
        if (!url && !domain) continue

        const row = {
            url: url || domain || "unknown-source",
            domain: domain || url || "unknown-source",
            source_type: source.source_type || "OTHER",
            is_cited: Boolean(source.is_cited),
            used_by_ai: true,
            source_kind: null,
            source_position: null,
            answer_position: null,
        }
        byKey.set(sourceKey(row.url, row.domain), row)
    }

    for (const citation of citations) {
        const url = citation.url?.trim()
        if (!url) continue
        const domain = citation.domain?.trim() || safeDomain(url)
        const key = sourceKey(url, domain)
        const existing = byKey.get(key)
        const title = citation.text && citation.text !== url ? citation.text : null
        const isCited = citation.is_cited ?? (citation.source_kind === "citation" || citation.source_kind === "attached_link")

        byKey.set(key, {
            url,
            domain,
            source_type: existing?.source_type ?? "OTHER",
            url_type: existing?.url_type ?? sourceKindToUrlType(citation.source_kind),
            is_cited: Boolean(citation.is_cited !== undefined ? isCited : existing?.is_cited || isCited),
            used_by_ai: true,
            title: existing?.title ?? title,
            snippet: existing?.snippet ?? citation.snippet ?? null,
            source_kind: existing?.source_kind ?? citation.source_kind ?? null,
            source_position: existing?.source_position ?? citation.position ?? null,
            answer_position: existing?.answer_position ?? citation.answer_position ?? null,
        })
    }

    rows.push(...byKey.values())
    return rows
}

function sourceKindToUrlType(sourceKind: string | null | undefined) {
    if (sourceKind === "reference") return "DOCUMENTATION"
    return "OTHER"
}

function sourceKey(url: string | null | undefined, domain: string | null | undefined) {
    return (url?.trim() || domain?.trim() || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "")
}

function safeDomain(url: string | null | undefined) {
    if (!url) return ""
    try {
        return new URL(url).hostname.replace(/^www\./, "")
    } catch {
        return url
    }
}

export async function getDashboardData({ project_id, filters }: { project_id: string, filters?: DashboardFilters }) {
    const chatWhere = buildChatWhere(project_id, filters || {})

    const brandStats = await ownBrandStats(chatWhere)
    const totalChats = brandStats.total
    if (totalChats === 0) return null

    let previousBrandStats: OwnBrandStats
    if (filters?.days) {
        const previousFilters = previousPeriodFilters(filters) ?? {}
        const previousWhere = buildChatWhere(project_id, previousFilters)
        previousWhere.created_at = previousPeriodDateWhere(filters)
        previousBrandStats = await ownBrandStats(previousWhere)
    } else {
        previousBrandStats = await previousAllTimeBrandStats(project_id, filters ?? {}, Math.floor(totalChats / 2))
    }

    // Sums rather than averages: the table has always divided by every mention of the brand,
    // counting a mention with no position as a zero, which is not what SQL AVG does.
    //
    // Brands tied on visibility are ordered by summed position, which inside a tied group is
    // the same ordering as the average position shown in the row, so the better-placed brand
    // comes first. The in-memory version left ties in whatever order Postgres happened to
    // return the rows in; the table now has a total order, which is also what makes it safe
    // to compare two runs.
    const competitorGroups = await prisma.brandMention.groupBy({
        by: ['brand_name'],
        where: { chat: chatWhere },
        _count: { _all: true },
        _sum: { position: true, sentiment_score: true },
        orderBy: [{ _count: { brand_name: 'desc' } }, { _sum: { position: 'asc' } }, { brand_name: 'asc' }],
    })

    const competitors = competitorGroups.map(group => ({
        brand_name: group.brand_name,
        visibility: (group._count._all / totalChats) * 100,
        avg_position: (group._sum.position ?? 0) / group._count._all,
        avg_sentiment: (group._sum.sentiment_score ?? 0) / group._count._all
    }))

    // A domain counts once per chat however many times that chat cited it, and Prisma's _count
    // is not distinct-aware, so this one stays raw. A domain can be filed under several types
    // across answers; OTHER is the extractor's fallback, so the most frequent real type wins
    // and OTHER is only reported when nothing else was ever recorded.
    const chatWhereSql = buildChatWhereSql(project_id, filters ?? {})
    const sourceRows = await prisma.$queryRaw<Array<{ domain: string, source_type: string, chat_count: number }>>`
        SELECT
            s.domain,
            COALESCE(
                mode() WITHIN GROUP (ORDER BY s.source_type) FILTER (WHERE s.source_type <> 'OTHER'),
                'OTHER'
            )::text AS source_type,
            COUNT(DISTINCT s.chat_id)::int AS chat_count
        FROM "Source" s
        JOIN "Chat" c ON c.id = s.chat_id
        JOIN "Prompt" p ON p.id = c.prompt_id
        WHERE ${chatWhereSql}
        GROUP BY s.domain
        ORDER BY chat_count DESC, s.domain ASC
        LIMIT ${TOP_SOURCES_LIMIT}
    `

    const topSources = sourceRows.map(row => ({
        domain: row.domain,
        source_type: row.source_type,
        usage_percentage: (row.chat_count / totalChats) * 100
    }))

    return {
        brand: {
            visibility: brandStats.visibility ?? 0,
            avg_position: brandStats.avg_position ?? 0,
            avg_sentiment: brandStats.avg_sentiment ?? 0,
            delta_visibility: deltaValue(brandStats.visibility, previousBrandStats?.visibility ?? null),
            delta_position: deltaValue(brandStats.avg_position, previousBrandStats?.avg_position ?? null, true),
            delta_sentiment: deltaValue(brandStats.avg_sentiment, previousBrandStats?.avg_sentiment ?? null)
        },
        competitors,
        topSources
    }
}

export async function getVisibilityTimeSeries(project_id: string, filters?: DashboardFilters) {
    const chatWhereSql = buildChatWhereSql(project_id, filters || {})

    const project = await prisma.project.findUniqueOrThrow({
        where: { id: project_id },
        include: { competitors: true }
    })
    const competitorNames = project.competitors.map(c => c.name)

    // The series is plotted against Run.ran_at, the day the answers were actually collected,
    // which is also the timestamp the chat lists hand the client. date_trunc on a
    // "timestamp without time zone" column holding UTC gives the same day boundary the old
    // toISOString().slice(0, 10) did, without a time-zone-dependent conversion.
    const dayRows = await prisma.$queryRaw<Array<{ date: string, total_chats: number, brand_hits: number }>>`
        SELECT
            to_char(date_trunc('day', r.ran_at), 'YYYY-MM-DD') AS date,
            COUNT(*)::int AS total_chats,
            (COUNT(*) FILTER (WHERE c.brand_mentioned))::int AS brand_hits
        FROM "Chat" c
        JOIN "Prompt" p ON p.id = c.prompt_id
        JOIN "Run" r ON r.id = c.run_id
        WHERE ${chatWhereSql}
        GROUP BY 1
        ORDER BY 1 ASC
    `

    if (dayRows.length === 0) return []

    // Only the configured competitors are ever read back out, so the grouping is bounded by
    // days x competitors instead of by the number of mentions in the period.
    const competitorRows = competitorNames.length === 0 ? [] : await prisma.$queryRaw<Array<{ date: string, brand_name: string, hits: number }>>`
        SELECT
            to_char(date_trunc('day', r.ran_at), 'YYYY-MM-DD') AS date,
            bm.brand_name,
            COUNT(*)::int AS hits
        FROM "BrandMention" bm
        JOIN "Chat" c ON c.id = bm.chat_id
        JOIN "Prompt" p ON p.id = c.prompt_id
        JOIN "Run" r ON r.id = c.run_id
        WHERE ${chatWhereSql}
          AND bm.brand_name = ANY(${competitorNames}::text[])
        GROUP BY 1, 2
    `

    const competitorHits = new Map<string, number>()
    for (const row of competitorRows) {
        competitorHits.set(`${row.date} ${row.brand_name}`, row.hits)
    }

    // Fallback domain for a competitor with no URL on record: the first one an answer reported
    // for that name, oldest run first, exactly as the old first-wins pass over the chats did.
    const mentionDomainRows = competitorNames.length === 0 ? [] : await prisma.$queryRaw<Array<{ brand_name: string, domain: string }>>`
        SELECT bm.brand_name, bm.domain
        FROM "BrandMention" bm
        JOIN "Chat" c ON c.id = bm.chat_id
        JOIN "Prompt" p ON p.id = c.prompt_id
        JOIN "Run" r ON r.id = c.run_id
        WHERE ${chatWhereSql}
          AND bm.domain IS NOT NULL
          AND bm.brand_name = ANY(${competitorNames}::text[])
        GROUP BY bm.brand_name, bm.domain
        ORDER BY bm.brand_name ASC, MIN(r.ran_at) ASC, MIN(c.created_at) ASC, bm.domain ASC
    `

    const mentionDomains = new Map<string, string>()
    for (const row of mentionDomainRows) {
        const domain = normalizeEntityDomain(row.domain)
        if (domain && !mentionDomains.has(row.brand_name)) {
            mentionDomains.set(row.brand_name, domain)
        }
    }

    return dayRows.map(day => {
        const brands: Record<string, number> = {
            [project.brand_name]: day.total_chats > 0 ? (day.brand_hits / day.total_chats) * 100 : 0
        }
        const brand_domains: Record<string, string | null> = {
            [project.brand_name]: normalizeEntityDomain(project.brand_url),
        }
        for (const name of competitorNames) {
            const hits = competitorHits.get(`${day.date} ${name}`) ?? 0
            brands[name] = day.total_chats > 0 ? (hits / day.total_chats) * 100 : 0
            const configuredUrl = project.competitors.find(competitor => competitor.name === name)?.url
            brand_domains[name] = normalizeEntityDomain(configuredUrl)
                ?? mentionDomains.get(name)
                ?? null
        }
        return { date: day.date, total_chats: day.total_chats, brands, brand_domains }
    })
}

export async function getRecentChats(project_id: string, filters?: DashboardFilters, limit = 9) {
    const chatWhere = buildChatWhere(project_id, filters || {})

    const chats = await prisma.chat.findMany({
        where: chatWhere,
        include: {
            brand_mentions: { select: { brand_name: true, sentiment_score: true, position: true } },
            sources: {
                select: {
                    domain: true,
                    url: true,
                    title: true,
                    snippet: true,
                    is_cited: true,
                    source_type: true,
                    url_type: true,
                    source_kind: true,
                    source_position: true,
                    answer_position: true,
                },
                orderBy: [
                    { is_cited: "desc" },
                    { answer_position: "asc" },
                    { source_position: "asc" },
                    { created_at: "asc" },
                ],
            },
            prompt: { select: { text: true } },
            run: { select: { ran_at: true } }
        },
        orderBy: { created_at: 'desc' },
        take: limit
    })

    return chats.map(chat => ({
        id: chat.id,
        ai_model: chat.ai_model,
        prompt_text: chat.prompt.text,
        excerpt: (chat.display_response || chat.raw_response)
            .replace(/[#*`\[\]>]/g, '')
            .replace(/\n/g, ' ')
            .slice(0, 200),
        raw_response: chat.raw_response,
        display_response: chat.display_response ?? null,
        answer_blocks: chat.answer_blocks,
        brand_mentioned: chat.brand_mentioned,
        brand_position: chat.brand_position,
        sentiment_score: chat.sentiment_score,
        brands: chat.brand_mentions.map(m => m.brand_name),
        brand_details: chat.brand_mentions,
        sources: chat.sources,
        screenshot_path: chat.screenshot_path,
        has_screenshot: Boolean(chat.screenshot_path?.startsWith("gs://")),
        ran_at: chat.run.ran_at
    }))
}

export async function getChatsPage(project_id: string, filters?: DashboardFilters, page = 1, pageSize = 10) {
    const chatWhere = buildChatWhere(project_id, filters || {})
    const safePage = Math.max(1, page)
    const safePageSize = Math.min(Math.max(1, pageSize), 50)

    const [total, chats] = await Promise.all([
        prisma.chat.count({ where: chatWhere }),
        prisma.chat.findMany({
            where: chatWhere,
            include: {
                brand_mentions: { select: { brand_name: true, sentiment_score: true, position: true } },
                sources: {
                    select: {
                        domain: true,
                        url: true,
                        title: true,
                        snippet: true,
                        is_cited: true,
                        source_type: true,
                        url_type: true,
                        source_kind: true,
                        source_position: true,
                        answer_position: true,
                    },
                    orderBy: [
                        { is_cited: "desc" },
                        { answer_position: "asc" },
                        { source_position: "asc" },
                        { created_at: "asc" },
                    ],
                },
                prompt: { select: { text: true } },
                run: { select: { ran_at: true } }
            },
            orderBy: { created_at: 'desc' },
            skip: (safePage - 1) * safePageSize,
            take: safePageSize
        })
    ])

    return {
        data: chats.map(chat => ({
            id: chat.id,
            ai_model: chat.ai_model,
            prompt_text: chat.prompt.text,
            excerpt: (chat.display_response || chat.raw_response)
                .replace(/[#*`\[\]>]/g, '') // strip markdown symbols for cleaner preview
                .replace(/\n/g, ' ')
                .slice(0, 200),
            raw_response: chat.raw_response,
            display_response: chat.display_response ?? null,
            answer_blocks: chat.answer_blocks,
            brand_mentioned: chat.brand_mentioned,
            brand_position: chat.brand_position,
            sentiment_score: chat.sentiment_score,
            brands: chat.brand_mentions.map(m => m.brand_name),
            brand_details: chat.brand_mentions,
            sources: chat.sources,
            screenshot_path: chat.screenshot_path,
            has_screenshot: Boolean(chat.screenshot_path?.startsWith("gs://")),
            ran_at: chat.run.ran_at
        })),
        page: safePage,
        page_size: safePageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / safePageSize))
    }
}
