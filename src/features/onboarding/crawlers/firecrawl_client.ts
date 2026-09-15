import axios from 'axios'
import { withRetry } from '../../../lib/retry'

export type FirecrawlPage = {
    url: string
    title: string | null
    description: string | null
    markdown: string
    html: string | null
}

type FirecrawlScrapeResponse = {
    success?: boolean
    error?: string
    data?: {
        markdown?: string
        html?: string
        metadata?: {
            title?: string
            description?: string
            sourceURL?: string
            url?: string
        }
    }
}

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape'

export function hasFirecrawlKey() {
    return Boolean(getFirecrawlKey())
}

export async function scrapeWithFirecrawl(url: string): Promise<FirecrawlPage> {
    const apiKey = getFirecrawlKey()
    if (!apiKey) {
        throw new Error('CRAWLER_API_KEY is missing; Firecrawl fallback cannot run.')
    }

    // Retried because this is the fallback the brand crawl reaches only when the cheap path
    // has already failed — losing it to one dropped connection sends onboarding on to Parallel,
    // a third provider and a third bill, for what a second attempt would usually have fixed.
    const response = await withRetry(() => axios.post<FirecrawlScrapeResponse>(
        FIRECRAWL_SCRAPE_URL,
        {
            url,
            formats: ['markdown', 'html'],
            onlyMainContent: true,
            timeout: 30000,
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 45000,
            validateStatus: status => status >= 200 && status < 500,
        }
    ), { label: `firecrawl ${url}`, attempts: 3 })

    if (response.status >= 400 || response.data.success === false) {
        throw new Error(response.data.error || `Firecrawl scrape failed with status ${response.status}.`)
    }

    const data = response.data.data
    const markdown = data?.markdown?.trim()

    if (!data || !markdown) {
        throw new Error('Firecrawl returned no readable markdown for this URL.')
    }

    return {
        url: data.metadata?.sourceURL || data.metadata?.url || url,
        title: data.metadata?.title || null,
        description: data.metadata?.description || null,
        markdown,
        html: data.html || null,
    }
}

function getFirecrawlKey() {
    return process.env.CRAWLER_API_KEY || process.env.FIRECRAWL_API_KEY
}
