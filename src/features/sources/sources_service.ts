import { Prisma } from "@prisma/client"
import prisma from "../../lib/prisma"
import { enrichSource } from "./source_enrichment_service"
import { buildChatWhere } from "../dashboard/dashboard_service"
import type { DashboardFilters } from "../dashboard/dashboard_service"

// A project's rollups are bounded by how many distinct domains and URLs it has, not by how
// many Source rows exist, but nothing stops a project from accumulating both. These caps
// keep the worst case inside a serverless function's memory; a report that needs more rows
// than this is not a report anyone reads, it is an export.
const MAX_DOMAIN_ROWS = 1000
const MAX_GAP_URL_ROWS = 2000
const MAX_TREND_DAYS = 400

// getSourceTrend and getSourceGaps used to read a project's entire history with no date
// window at all, which at a realistic year is ~400k Source rows pulled into one function.
// Nothing in this file establishes a default window - every other function only narrows by
// date when the caller passes filters.days - so this takes the longest range the UI's own
// time-range dropdown offers. It is a deliberate behaviour change: anything older than this
// no longer contributes to the trend chart or the gap list.
const DEFAULT_HISTORY_DAYS = 90

export type SourcePage<T> = {
    items: T[]
    page: number
    page_size: number
    total: number
    total_pages: number
}

function paginate<T>(items: T[], page = 1, pageSize = 20): SourcePage<T> {
    const safePageSize = Math.min(Math.max(pageSize, 1), 100)
    const safePage = Math.max(page, 1)
    const start = (safePage - 1) * safePageSize
    return {
        items: items.slice(start, start + safePageSize),
        page: safePage,
        page_size: safePageSize,
        total: items.length,
        total_pages: Math.max(1, Math.ceil(items.length / safePageSize))
    }
}

function matchesSearch(value: string, search?: string) {
    const needle = search?.trim().toLowerCase()
    return !needle || value.toLowerCase().includes(needle)
}

// Every rollup below joins Source to its Chat, and a Chat is only in scope once it has been
// through the project/date/model/geo/search filters. These joins give the raw queries the
// aliases buildChatWhereSql writes against.
const CHAT_SCOPE_JOINS = Prisma.sql`
    JOIN "Prompt" p ON p.id = c.prompt_id
    JOIN "Run" r ON r.id = c.run_id
`

// buildChatWhere() in dashboard_service.ts is the single definition of what "the chats this
// dashboard is looking at" means, and it is shared with the rest of the product. The rollups
// here run inside Postgres, so that predicate has to exist as SQL as well, and this mirrors
// it clause for clause over the aliases above. It is deliberately literal rather than
// clever: a raw query that quietly drops one filter would mix another period's or another
// prompt's numbers into an answer that still looks plausible, which is a worse bug than the
// slow version this replaces. The scratchpad harness snapshot_sources.mts asserts, for every
// filter and every project, that this predicate and buildChatWhere select the same Chat rows,
// so the mirror is checked rather than trusted.
//
// Every value is interpolated through the tagged template, which parameterises it. Nothing
// here is ever concatenated into the SQL text.
function buildChatWhereSql(project_id: string, filters: DashboardFilters): Prisma.Sql {
    // where.prompt is { project_id } and stays scoped to the project even when a prompt
    // filter replaces it, so the project condition is unconditional.
    const conditions: Prisma.Sql[] = [Prisma.sql`p.project_id = ${project_id}`]

    if (filters.days) {
        const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000)
        // created_at is TIMESTAMP(3) without a zone holding UTC, and casting an ISO string
        // to `timestamp` makes Postgres read the same wall clock the JS Date encodes. Passing
        // the Date object instead would leave the interpretation up to the driver.
        conditions.push(Prisma.sql`c.created_at >= ${since.toISOString()}::timestamp`)
    }

    if (filters.model && filters.model !== 'all') {
        conditions.push(Prisma.sql`c.ai_model ILIKE '%' || ${filters.model} || '%'`)
    }

    if (filters.country && filters.country !== 'all') {
        conditions.push(Prisma.sql`(
            c.geo_country_code = ${filters.country}
            OR c.geo_country_name ILIKE ${filters.country}
        )`)
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
        conditions.push(Prisma.sql`${filters.tag} = ANY(p.tags)`)
    }

    if (filters.prompt_id) {
        conditions.push(Prisma.sql`p.id = ${filters.prompt_id}`)
    }

    const q = filters.q?.trim()
    if (q) {
        // ILIKE with the needle wrapped in literal percent signs is what Prisma's
        // `contains` + `mode: 'insensitive'` compiles to. Prisma does not escape % or _ in
        // the needle either, so this does not escape them: matching the quirk is what keeps
        // search results identical.
        conditions.push(Prisma.sql`(
            c.raw_response ILIKE '%' || ${q} || '%'
            OR p.text ILIKE '%' || ${q} || '%'
            OR EXISTS (SELECT 1 FROM "BrandMention" qm WHERE qm.chat_id = c.id AND qm.brand_name ILIKE '%' || ${q} || '%')
            OR EXISTS (SELECT 1 FROM "Source" qd WHERE qd.chat_id = c.id AND qd.domain ILIKE '%' || ${q} || '%')
            OR EXISTS (SELECT 1 FROM "Source" qt WHERE qt.chat_id = c.id AND qt.title ILIKE '%' || ${q} || '%')
        )`)
    }

    return Prisma.join(conditions, " AND ")
}

// If DashboardFilters grows a field, this stops compiling until buildChatWhereSql above has
// a clause for it. It is a reminder, not the guarantee - the guarantee is the harness.
const SQL_MIRRORED_FILTERS: Record<keyof DashboardFilters, true> = {
    days: true, model: true, topic: true, tag: true, prompt_id: true,
    q: true, country: true, intent: true, mentioned: true, cited: true,
}
void SQL_MIRRORED_FILTERS

// getTopSources and getDomaEUReport both narrow by buildChatWhere *and* by run.project_id.
// getSourceTrend and getSourceGaps deliberately do not - they only scope by the run - so
// they build their own predicate instead of calling this.
function chatScopeWhereSql(project_id: string, filters: DashboardFilters): Prisma.Sql {
    return Prisma.sql`${buildChatWhereSql(project_id, filters)} AND r.project_id = ${project_id}`
}

// The denominator of every percentage on this page is the number of chats in scope,
// including chats that produced no sources at all, so it cannot be derived from the grouped
// source query without inflating every rate.
async function countScopedChats(where: Prisma.Sql) {
    const [row] = await prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
        FROM "Chat" c
        ${CHAT_SCOPE_JOINS}
        WHERE ${where}
    `
    return row?.total ?? 0
}

/**
 * Exported for the scratchpad verification harness only. It counts the chats the raw-SQL
 * predicate selects so the harness can compare that against prisma.chat.count() through
 * buildChatWhere, for every filter combination. Keeping the comparison runnable is what
 * stops the SQL mirror from drifting the next time a filter is added.
 */
export async function __chatFilterParityProbe(project_id: string, filters: DashboardFilters = {}) {
    return countScopedChats(chatScopeWhereSql(project_id, filters))
}

// All four reports used to take "the first row wins" from whatever order Postgres happened
// to hand Prisma's nested read: source_type, the url_types list, the order of equally ranked
// domains, and every gap tie-break came out of physical row order. That is not something to
// rebuild a report on, and it drifts the moment the enrichment worker updates a row. This
// replaces it with the ordering this codebase already treats as canonical for a chat's
// sources - see the sources orderBy in getRecentChats - applied to chats in creation order.
// It is deterministic, and on production data it reproduces the order the old code produced.
//
// Every query below numbers its rows with this and then aggregates the numbering away, so a
// domain's "first" row means the same thing everywhere.
const SOURCE_SCAN_ORDER = Prisma.sql`
    c.created_at ASC, c.id ASC,
    s.is_cited DESC, s.answer_position ASC, s.source_position ASC, s.created_at ASC, s.id ASC
`

type DomainIdentity = { source_type: string, url_types: string[] }

// source_type is the first row's, url_types is in first-seen order - the same shape the old
// Map-and-Set code produced. Grouping to (domain, url_type, source_type) keeps the number of
// rows crossing the wire proportional to the number of domains, not to Source rows.
async function fetchDomainIdentities(where: Prisma.Sql, domains: string[]) {
    const identities = new Map<string, DomainIdentity>()
    if (domains.length === 0) return identities

    const rows = await prisma.$queryRaw<{ domain: string, url_type: string, source_type: string }[]>`
        WITH ranked AS (
            SELECT s.domain AS domain,
                   s.url_type::text AS url_type,
                   s.source_type::text AS source_type,
                   ROW_NUMBER() OVER (ORDER BY ${SOURCE_SCAN_ORDER}) AS rn
            FROM "Source" s
            JOIN "Chat" c ON c.id = s.chat_id
            ${CHAT_SCOPE_JOINS}
            WHERE ${where} AND s.domain = ANY(${domains}::text[])
        )
        SELECT domain, url_type, source_type
        FROM ranked
        GROUP BY domain, url_type, source_type
        ORDER BY domain ASC, MIN(rn) ASC
    `

    for (const row of rows) {
        const existing = identities.get(row.domain)
        if (!existing) {
            identities.set(row.domain, { source_type: row.source_type, url_types: [row.url_type] })
            continue
        }
        if (!existing.url_types.includes(row.url_type)) existing.url_types.push(row.url_type)
    }

    return identities
}

export async function getTopSources(project_id: string, filters: DashboardFilters = {}) {
    const where = chatScopeWhereSql(project_id, filters)
    const totalChats = await countScopedChats(where)
    if (totalChats === 0) return []

    // This used to read every Source row of every matching chat and then run a filter() per
    // domain per chat, which is quadratic in the sources of a single chat and linear in the
    // whole table. The two numbers it was deriving are a COUNT(DISTINCT chat_id) and a
    // COUNT(*) FILTER (WHERE is_cited), both of which Postgres answers without sending a row
    // per source. Prisma's groupBy cannot express the distinct count - _count is not
    // distinct-aware - so this is raw.
    const rows = await prisma.$queryRaw<{ domain: string, chat_count: number, citation_count: number }[]>`
        WITH ranked AS (
            SELECT s.domain AS domain,
                   s.chat_id AS chat_id,
                   s.is_cited AS is_cited,
                   ROW_NUMBER() OVER (ORDER BY ${SOURCE_SCAN_ORDER}) AS rn
            FROM "Source" s
            JOIN "Chat" c ON c.id = s.chat_id
            ${CHAT_SCOPE_JOINS}
            WHERE ${where}
        )
        SELECT domain,
               COUNT(DISTINCT chat_id)::int AS chat_count,
               (COUNT(*) FILTER (WHERE is_cited))::int AS citation_count
        FROM ranked
        GROUP BY domain
        ORDER BY chat_count DESC, MIN(rn) ASC
        LIMIT ${MAX_DOMAIN_ROWS}
    `

    const identities = await fetchDomainIdentities(where, rows.map(row => row.domain))

    // The divisions stay in JavaScript on purpose: Postgres would hand back a Decimal for
    // them, which does not round the way the double this endpoint has always returned does.
    return rows.map(row => ({
        domain: row.domain,
        source_type: identities.get(row.domain)?.source_type ?? 'OTHER',
        used_percentage: (row.chat_count / totalChats) * 100,
        avg_citations: row.citation_count / row.chat_count
    })).sort((a, b) => b.used_percentage - a.used_percentage)
}

export async function getDomaEUReport(project_id: string, filters: DashboardFilters = {}) {
    const where = chatScopeWhereSql(project_id, filters)
    const totalChats = await countScopedChats(where)
    if (totalChats === 0) return []

    // Three of the four numbers per domain are distinct counts, which is exactly what the
    // Set-of-chat-ids and Set-of-urls in the old JavaScript were emulating, one row at a time.
    const rows = await prisma.$queryRaw<{
        domain: string
        retrieval_count: number
        citation_count: number
        unique_urls: number
    }[]>`
        WITH ranked AS (
            SELECT s.domain AS domain,
                   s.chat_id AS chat_id,
                   s.url AS url,
                   s.is_cited AS is_cited,
                   ROW_NUMBER() OVER (ORDER BY ${SOURCE_SCAN_ORDER}) AS rn
            FROM "Source" s
            JOIN "Chat" c ON c.id = s.chat_id
            ${CHAT_SCOPE_JOINS}
            WHERE ${where}
        )
        SELECT domain,
               COUNT(DISTINCT chat_id)::int AS retrieval_count,
               (COUNT(*) FILTER (WHERE is_cited))::int AS citation_count,
               COUNT(DISTINCT url)::int AS unique_urls
        FROM ranked
        GROUP BY domain
        ORDER BY retrieval_count DESC, MIN(rn) ASC
        LIMIT ${MAX_DOMAIN_ROWS}
    `

    const identities = await fetchDomainIdentities(where, rows.map(row => row.domain))

    return rows.map(row => {
        const identity = identities.get(row.domain)
        return {
            domain: row.domain,
            source_type: identity?.source_type ?? 'OTHER',
            url_types: identity?.url_types ?? [],
            unique_urls: row.unique_urls,
            retrieval_count: row.retrieval_count,
            retrieval_rate: (row.retrieval_count / totalChats) * 100,
            citation_count: row.citation_count,
            citation_rate: row.retrieval_count > 0 ? (row.citation_count / row.retrieval_count) * 100 : 0
        }
    }).sort((a, b) => b.retrieval_rate - a.retrieval_rate)
}

export async function getDomaEUReportPage(
    project_id: string,
    filters: DashboardFilters = {},
    options: { page?: number, pageSize?: number, search?: string } = {}
) {
    const rows = await getDomaEUReport(project_id, filters)
    const search = options.search?.trim().toLowerCase()
    const filtered = search
        ? rows.filter(row => matchesSearch(`${row.domain} ${row.source_type}`, search))
        : rows
    return paginate(filtered, options.page, options.pageSize)
}

export async function getUrlReport(project_id: string, filters: DashboardFilters = {}) {
    const sources = await prisma.source.findMany({
        where: { chat: { ...buildChatWhere(project_id, filters), run: { project_id } } },
        include: {
            source_url_content: true,
            // `select`, not `include`. Prisma's include pulls every scalar on Chat, which
            // means raw_response - roughly 3KB of answer text per row - and answer_blocks.
            // There are about eight Sources per Chat, so each answer was being fetched eight
            // times over; across a year of one project that is gigabytes crossing the wire to
            // read one string. The brand_mentions relation was loaded here and never read at
            // all: this function derives its brands from Source.mentioned_brands instead.
            chat: {
                select: {
                    prompt: { select: { text: true } }
                }
            }
        },
        orderBy: { created_at: "desc" }
    })

    const urlMap = new Map<string, {
        url: string
        domain: string
        title: string | null
        source_type: string
        url_type: string
        platform: string | null
        subreddit: string | null
        retrievals: number
        citations: number
        prompts: Set<string>
        mentionedBrands: Set<string>
        snippet: string | null
        content_updated_at: Date | null
        content_length: number
        fetch_status: string | null
        error_reason: string | null
    }>()

    for (const source of sources) {
        const existing = urlMap.get(source.url) ?? {
            url: source.url,
            domain: source.domain,
            title: source.title ?? source.source_url_content?.title ?? null,
            source_type: source.source_type,
            url_type: source.url_type,
            platform: source.platform,
            subreddit: source.subreddit,
            retrievals: 0,
            citations: 0,
            prompts: new Set<string>(),
            mentionedBrands: new Set<string>(),
            snippet: source.snippet ?? source.source_url_content?.snippet ?? null,
            content_updated_at: source.source_url_content?.content_updated_at ?? null,
            content_length: source.source_url_content?.content_length ?? 0,
            fetch_status: source.source_url_content?.fetch_status ?? null,
            error_reason: source.source_url_content?.error_reason ?? null
        }

        existing.retrievals += 1
        if (source.is_cited) existing.citations += 1
        existing.prompts.add(source.chat.prompt.text)
        if (!existing.snippet && source.source_url_content?.snippet) existing.snippet = source.source_url_content.snippet
        if (!existing.content_updated_at && source.source_url_content?.content_updated_at) {
            existing.content_updated_at = source.source_url_content.content_updated_at
        }
        if ((source.source_url_content?.content_length ?? 0) > existing.content_length) {
            existing.content_length = source.source_url_content?.content_length ?? 0
        }
        if (!existing.fetch_status && source.source_url_content?.fetch_status) {
            existing.fetch_status = source.source_url_content.fetch_status
        }
        if (!existing.error_reason && source.source_url_content?.error_reason) {
            existing.error_reason = source.source_url_content.error_reason
        }

        const sourceBrands = Array.isArray(source.mentioned_brands) ? source.mentioned_brands : []
        const contentBrands = Array.isArray(source.source_url_content?.mentioned_brands)
            ? source.source_url_content.mentioned_brands
            : []
        for (const brand of [...sourceBrands, ...contentBrands]) {
            if (typeof brand === "string") existing.mentionedBrands.add(brand)
        }

        urlMap.set(source.url, existing)
    }

    return Array.from(urlMap.values()).map(item => ({
        url: item.url,
        domain: item.domain,
        title: item.title,
        source_type: item.source_type,
        url_type: item.url_type,
        platform: item.platform,
        subreddit: item.subreddit,
        retrievals: item.retrievals,
        citations: item.citations,
        citation_rate: item.retrievals > 0 ? (item.citations / item.retrievals) * 100 : 0,
        prompts: Array.from(item.prompts),
        mentioned_brands: Array.from(item.mentionedBrands),
        snippet: item.snippet,
        content_updated_at: item.content_updated_at,
        content_length: item.content_length,
        fetch_status: item.fetch_status,
        error_reason: item.error_reason
    })).sort((a, b) => b.retrievals - a.retrievals)
}

export async function getUrlReportPage(
    project_id: string,
    filters: DashboardFilters = {},
    options: { page?: number, pageSize?: number, search?: string, domain?: string } = {}
) {
    const rows = await getUrlReport(project_id, filters)
    const search = options.search?.trim().toLowerCase()
    const domain = options.domain?.trim().toLowerCase()
    const filtered = rows.filter(row => {
        const domainMatch = !domain || row.domain.toLowerCase() === domain
        const searchMatch = !search || matchesSearch(
            `${row.url} ${row.domain} ${row.title ?? ""} ${row.url_type ?? ""}`,
            search
        )
        return domainMatch && searchMatch
    })
    return paginate(filtered, options.page, options.pageSize)
}

export async function getUrlContent(project_id: string, url: string) {
    const source = await findProjectSourceByUrl(project_id, url)

    if (!source) return null

    if (source.source_url_content) return source.source_url_content

    const matchedContent = await findExistingContentByUrl(source.url)
    if (matchedContent) {
        await prisma.source.updateMany({
            where: { url: source.url },
            data: {
                source_url_content_id: matchedContent.id,
                title: matchedContent.title,
                snippet: matchedContent.snippet,
                source_type: matchedContent.source_type,
                url_type: matchedContent.url_type,
                platform: matchedContent.platform,
                subreddit: matchedContent.subreddit,
                mentioned_brands: matchedContent.mentioned_brands ?? []
            }
        })
        return matchedContent
    }

    // Details drawer should be useful even if the background worker has not reached this URL yet.
    return enrichSource(source.id)
}

async function findProjectSourceByUrl(project_id: string, url: string) {
    const exact = await prisma.source.findFirst({
        where: {
            url,
            chat: { run: { project_id } }
        },
        include: { source_url_content: true },
        orderBy: { created_at: "desc" }
    })
    if (exact) return exact

    const targetKey = canonicalUrlKey(url)
    const domain = safeDomain(url)
    const candidates = await prisma.source.findMany({
        where: {
            domain,
            chat: { run: { project_id } }
        },
        include: { source_url_content: true },
        orderBy: { created_at: "desc" },
        take: 100
    })

    return candidates.find(source => canonicalUrlKey(source.url) === targetKey) ?? null
}

async function findExistingContentByUrl(url: string) {
    const exact = await prisma.sourceUrlContent.findUnique({ where: { url } })
    if (exact) return exact

    const targetKey = canonicalUrlKey(url)
    const domain = safeDomain(url)
    const candidates = await prisma.sourceUrlContent.findMany({
        where: { domain },
        orderBy: { updated_at: "desc" },
        take: 100
    })

    return candidates.find(content => canonicalUrlKey(content.url) === targetKey) ?? null
}

function canonicalUrlKey(url: string) {
    try {
        const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
        parsed.hash = ""
        for (const key of Array.from(parsed.searchParams.keys())) {
            if (
                key.toLowerCase().startsWith("utm_") ||
                ["fbclid", "gclid", "msclkid"].includes(key.toLowerCase())
            ) {
                parsed.searchParams.delete(key)
            }
        }
        const host = parsed.hostname.replace(/^www\./, "").toLowerCase()
        const path = parsed.pathname.replace(/\/+$/, "") || "/"
        const query = parsed.searchParams.toString()
        return `${host}${path}${query ? `?${query}` : ""}`
    } catch {
        return url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "")
    }
}

function safeDomain(url: string) {
    try {
        return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase()
    } catch {
        return url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    }
}

export async function getSourceTrend(project_id: string) {
    const since = new Date(Date.now() - DEFAULT_HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    // This function scopes by the run only, never by buildChatWhere - the controller passes
    // no filters - so it builds its own predicate rather than reusing chatScopeWhereSql.
    const scope = Prisma.sql`r.project_id = ${project_id} AND c.created_at >= ${since}::timestamp`

    // The day buckets have to come off Chat, not Source: total_chats counts every chat that
    // ran that day, and a day whose chats happened to cite none of the top domains still has
    // to appear in the series with an empty domains array.
    //
    // first_chat_at comes back as text rather than a timestamp because the driver decides how
    // to interpret a zoneless timestamp, and the label below depends on getting the exact
    // instant. Formatting it as UTC text and re-parsing removes the driver from that decision.
    const days = await prisma.$queryRaw<{ date: string, total_chats: number, first_chat_at: string }[]>`
        SELECT to_char(c.created_at, 'YYYY-MM-DD') AS date,
               COUNT(*)::int AS total_chats,
               to_char(MIN(c.created_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS first_chat_at
        FROM "Chat" c
        JOIN "Run" r ON r.id = c.run_id
        WHERE ${scope}
        GROUP BY 1
        ORDER BY 1 ASC
        LIMIT ${MAX_TREND_DAYS}
    `
    if (days.length === 0) return []

    // The top-six selection stays unwindowed. Windowing it too would change which domains
    // the chart tracks rather than just which days it covers, and now that the domain report
    // is a Postgres rollup, reading all of history to rank domains costs one grouped scan.
    const topDomains = await getDomaEUReport(project_id)
    const domainTypes = new Map(topDomains.slice(0, 6).map(source => [source.domain, source.source_type]))
    const domains = Array.from(domainTypes.keys())

    const perDay = domains.length === 0
        ? []
        : await prisma.$queryRaw<{ date: string, domain: string, chat_count: number, citation_count: number }[]>`
            WITH ranked AS (
                SELECT to_char(c.created_at, 'YYYY-MM-DD') AS date,
                       s.domain AS domain,
                       s.chat_id AS chat_id,
                       s.is_cited AS is_cited,
                       ROW_NUMBER() OVER (ORDER BY ${SOURCE_SCAN_ORDER}) AS rn
                FROM "Source" s
                JOIN "Chat" c ON c.id = s.chat_id
                JOIN "Run" r ON r.id = c.run_id
                WHERE ${scope} AND s.domain = ANY(${domains}::text[])
            )
            SELECT date,
                   domain,
                   COUNT(DISTINCT chat_id)::int AS chat_count,
                   (COUNT(*) FILTER (WHERE is_cited))::int AS citation_count
            FROM ranked
            GROUP BY date, domain
            ORDER BY date ASC, MIN(rn) ASC
        `

    const byDate = new Map<string, typeof perDay>()
    for (const row of perDay) {
        const bucket = byDate.get(row.date) ?? []
        bucket.push(row)
        byDate.set(row.date, bucket)
    }

    return days.map(day => ({
        date: day.date,
        // The label is still formatted in JavaScript because it always has been: date is the
        // UTC day but toLocaleDateString renders in the server's timezone, so the two can name
        // different days for a chat near midnight. Postgres cannot reproduce that mismatch,
        // and reproducing it is the point.
        label: new Date(day.first_chat_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        total_chats: day.total_chats,
        domains: (byDate.get(day.date) ?? []).map(row => ({
            domain: row.domain,
            source_type: domainTypes.get(row.domain) ?? 'OTHER',
            usage_percentage: day.total_chats > 0 ? (row.chat_count / day.total_chats) * 100 : 0,
            citation_count: row.citation_count
        }))
    }))
}

export async function getSourceGaps(project_id: string) {
    const project = await prisma.project.findUniqueOrThrow({
        where: { id: project_id },
        include: { competitors: true }
    })

    const since = new Date(Date.now() - DEFAULT_HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    // Like getSourceTrend, this scopes by the run only - the controller passes no filters.
    const scope = Prisma.sql`r.project_id = ${project_id} AND c.created_at >= ${since}::timestamp`

    // Step one narrows the whole Source table to the URLs worth scoring. retrievals is the
    // dominant term in gap_score, so ranking by it keeps the URLs most likely to reach the
    // top of the list; see the note on MAX_GAP_URL_ROWS for what that cap costs.
    const counts = await prisma.$queryRaw<{ url: string, retrievals: number, citations: number }[]>`
        WITH ranked AS (
            SELECT s.url AS url,
                   s.is_cited AS is_cited,
                   ROW_NUMBER() OVER (ORDER BY ${SOURCE_SCAN_ORDER}) AS rn
            FROM "Source" s
            JOIN "Chat" c ON c.id = s.chat_id
            JOIN "Run" r ON r.id = c.run_id
            WHERE ${scope}
        )
        SELECT url,
               COUNT(*)::int AS retrievals,
               (COUNT(*) FILTER (WHERE is_cited))::int AS citations
        FROM ranked
        GROUP BY url
        ORDER BY retrievals DESC, MIN(rn) ASC
        LIMIT ${MAX_GAP_URL_ROWS}
    `
    if (counts.length === 0) return []
    const urls = counts.map(row => row.url)

    // The identity columns come from whichever source row was seen first for a URL, which is
    // what the old first-write-wins gapMap entry did. Grouping rather than taking one row also
    // yields every distinct title a URL has appeared under, which brand inference needs.
    const identityRows = await prisma.$queryRaw<{
        url: string
        domain: string
        title: string | null
        source_type: string
        url_type: string
        platform: string | null
        subreddit: string | null
    }[]>`
        WITH ranked AS (
            SELECT s.url AS url,
                   s.domain AS domain,
                   COALESCE(s.title, suc.title) AS title,
                   s.source_type::text AS source_type,
                   s.url_type::text AS url_type,
                   s.platform AS platform,
                   s.subreddit AS subreddit,
                   ROW_NUMBER() OVER (ORDER BY ${SOURCE_SCAN_ORDER}) AS rn
            FROM "Source" s
            JOIN "Chat" c ON c.id = s.chat_id
            JOIN "Run" r ON r.id = c.run_id
            LEFT JOIN "SourceUrlContent" suc ON suc.id = s.source_url_content_id
            WHERE ${scope} AND s.url = ANY(${urls}::text[])
        )
        SELECT url, domain, title, source_type, url_type, platform, subreddit
        FROM ranked
        GROUP BY url, domain, title, source_type, url_type, platform, subreddit
        ORDER BY url ASC, MIN(rn) ASC
    `

    // mentioned_brands is a JSONB array. Only string elements counted before, so the
    // jsonb_typeof guard keeps a malformed entry from turning into the text "null" or "42".
    const sourceBrandRows = await prisma.$queryRaw<{ url: string, brand: string }[]>`
        WITH ranked AS (
            SELECT s.url AS url,
                   e.value #>> '{}' AS brand,
                   ROW_NUMBER() OVER (ORDER BY ${SOURCE_SCAN_ORDER}, e.ord ASC) AS rn
            FROM "Source" s
            JOIN "Chat" c ON c.id = s.chat_id
            JOIN "Run" r ON r.id = c.run_id
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(s.mentioned_brands) = 'array' THEN s.mentioned_brands ELSE '[]'::jsonb END
            ) WITH ORDINALITY AS e(value, ord)
            WHERE ${scope} AND s.url = ANY(${urls}::text[]) AND jsonb_typeof(e.value) = 'string'
        )
        SELECT url, brand
        FROM ranked
        GROUP BY url, brand
        ORDER BY url ASC, MIN(rn) ASC
    `

    // Brands the answer itself mentioned, for every chat that retrieved this URL.
    const answerBrandRows = await prisma.$queryRaw<{ url: string, brand: string }[]>`
        WITH ranked AS (
            SELECT s.url AS url,
                   bm.brand_name AS brand,
                   ROW_NUMBER() OVER (ORDER BY ${SOURCE_SCAN_ORDER}, bm.position ASC, bm.created_at ASC, bm.id ASC) AS rn
            FROM "Source" s
            JOIN "Chat" c ON c.id = s.chat_id
            JOIN "Run" r ON r.id = c.run_id
            JOIN "BrandMention" bm ON bm.chat_id = c.id
            WHERE ${scope} AND s.url = ANY(${urls}::text[])
        )
        SELECT url, brand
        FROM ranked
        GROUP BY url, brand
        ORDER BY url ASC, MIN(rn) ASC
    `

    const identities = new Map<string, {
        domain: string
        title: string | null
        source_type: string
        url_type: string
        platform: string | null
        subreddit: string | null
        titles: string[]
    }>()
    for (const row of identityRows) {
        const existing = identities.get(row.url)
        if (!existing) {
            identities.set(row.url, { ...row, titles: row.title ? [row.title] : [] })
            continue
        }
        if (row.title && !existing.titles.includes(row.title)) existing.titles.push(row.title)
    }

    const groupByUrl = (rows: { url: string, brand: string }[]) => {
        const grouped = new Map<string, string[]>()
        for (const row of rows) {
            const existing = grouped.get(row.url)
            if (existing) existing.push(row.brand)
            else grouped.set(row.url, [row.brand])
        }
        return grouped
    }
    const sourceBrandsByUrl = groupByUrl(sourceBrandRows)
    const answerBrandsByUrl = groupByUrl(answerBrandRows)

    const brandName = project.brand_name.toLowerCase()
    const trackedCompetitors = new Set(project.competitors.map(competitor => competitor.name.toLowerCase()))

    return counts.flatMap(row => {
        const identity = identities.get(row.url)
        if (!identity) return []

        // Brand matching is string work that Postgres has no business doing, so it still runs
        // in JavaScript - but once per URL over the union of that URL's rows, instead of once
        // per row. The one semantic consequence is that the "use the source's own brands, fall
        // back to inference" choice is now made for the URL rather than for each row.
        const sourceBrands = sourceBrandsByUrl.get(row.url) ?? []
        const answerBrands = answerBrandsByUrl.get(row.url) ?? []
        const candidateBrands = [
            project.brand_name,
            ...project.competitors.map(competitor => competitor.name),
            ...answerBrands
        ]
        const titleVariants = identity.titles.length > 0 ? identity.titles : [null]
        const inferredBrands = [...new Set(titleVariants.flatMap(title =>
            inferBrandsFromSourceIdentity(row.url, identity.domain, title, candidateBrands)
        ))]
        const sourceLevelBrands = sourceBrands.length > 0 ? sourceBrands : inferredBrands
        const answerCompetitorBrands = answerBrands.filter(brand => brand.toLowerCase() !== brandName)
        const competitorBrands = sourceLevelBrands.length > 0 ? sourceLevelBrands : answerCompetitorBrands

        const mentionedOwnBrand = sourceLevelBrands.some(brand => brand.toLowerCase() === brandName)
        const competitorHits: string[] = []
        const trackedHits: string[] = []
        for (const brand of competitorBrands) {
            const normalized = brand.toLowerCase()
            if (normalized === brandName) continue
            if (!competitorHits.includes(brand)) competitorHits.push(brand)
            if (trackedCompetitors.has(normalized) && !trackedHits.includes(brand)) trackedHits.push(brand)
        }

        return [{
            url: row.url,
            domain: identity.domain,
            title: identity.title,
            source_type: identity.source_type,
            url_type: identity.url_type,
            platform: identity.platform,
            subreddit: identity.subreddit,
            retrievals: row.retrievals,
            citations: row.citations,
            mentioned_own_brand: mentionedOwnBrand,
            mentioned_competitors: competitorHits,
            tracked_competitors: trackedHits,
            gap_score: !mentionedOwnBrand && competitorHits.length > 0 ? row.retrievals * competitorHits.length : 0,
            suggested_action: buildSuggestedAction(identity, mentionedOwnBrand, competitorHits)
        }]
    }).filter(gap => gap.gap_score > 0).sort((a, b) => b.gap_score - a.gap_score)
}

export async function getSourceGapsPage(
    project_id: string,
    options: { page?: number, pageSize?: number, search?: string, domain?: string } = {}
) {
    const rows = await getSourceGaps(project_id)
    const search = options.search?.trim().toLowerCase()
    const domain = options.domain?.trim().toLowerCase()
    const filtered = rows.filter(row => {
        const domainMatch = !domain || row.domain.toLowerCase() === domain
        const searchMatch = !search || matchesSearch(
            `${row.url} ${row.domain} ${row.title ?? ""} ${row.url_type ?? ""}`,
            search
        )
        return domainMatch && searchMatch
    })
    return paginate(filtered, options.page, options.pageSize)
}

function buildSuggestedAction(
    url: { domain: string, platform: string | null, subreddit: string | null, url_type: string },
    hasBrand: boolean,
    competitors: string[]
) {
    if (hasBrand) return "Maintain presence on this source."
    if (url.platform === "reddit") {
        return `Join or monitor ${url.subreddit ?? "this Reddit discussion"} because competitors ${competitors.join(", ")} are visible there.`
    }
    if (url.url_type === "LISTICLE" || url.url_type === "COMPARISON") {
        return `Pitch ${url.domain} or improve content so your brand appears alongside ${competitors.join(", ")}.`
    }
    return `Investigate ${url.domain}; competitors ${competitors.join(", ")} appear in a source used by AI answers.`
}

function inferBrandsFromSourceIdentity(url: string, domain: string, title: string | null, brands: string[]) {
    const haystack = `${url} ${domain} ${title ?? ""}`.toLowerCase()
    const normalizedDomain = domain.replace(/^www\./, "").split(".")[0].toLowerCase()

    return [...new Set(brands.filter(brand => {
        const normalizedBrand = brand.toLowerCase()
        const compactBrand = normalizedBrand.replace(/[^a-z0-9]/g, "")
        const compactHaystack = haystack.replace(/[^a-z0-9]/g, "")

        return haystack.includes(normalizedBrand)
            || compactHaystack.includes(compactBrand)
            || compactBrand.includes(normalizedDomain)
            || normalizedDomain.includes(compactBrand)
    }))]
}
