import "../../lib/env"
import assert from "node:assert/strict"
import { normalizeAnalysisResult } from "./gemini_service"
import type { AnalysisResult } from "../../prompts/analysis_prompts"

/**
 * Visibility is the number this product exists to report, and it is derived from whether the
 * tracked brand appeared in an answer. That used to be decided by
 * `analysis.brand_mentioned || semanticTrackedMention` — an OR, so a model that invented an
 * appearance produced a BrandMention row that looked exactly like a real one.
 *
 * These cases pin the rule that replaced it: a claim is accepted only when the answer we hold
 * actually supports it, and the supporting forms are named here so that widening or narrowing
 * them is a deliberate edit rather than a side effect.
 */

const BRAND = "Acme Analytics"
const BRAND_URL = "https://acmeanalytics.com"

function analysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
    return {
        brand_mentioned: true,
        matched_brand_name: null,
        match_confidence: null,
        brand_position: 1,
        sentiment_score: 0.5,
        brand_mentions: [],
        sources: [],
        ...overrides,
    }
}

function trackedMentions(result: AnalysisResult) {
    return result.brand_mentions.filter(mention => mention.entity_type === "TRACKED_BRAND")
}

// ── Refused: the model claims a mention the answer does not support ───────────

const invented = normalizeAnalysisResult(
    analysis(),
    "The leading options here are Tableau, Looker and Power BI.",
    BRAND,
    BRAND_URL,
)
assert.equal(invented.brand_mentioned, false, "a claim with no support in the text must not count")
assert.equal(trackedMentions(invented).length, 0, "and must not leave a TRACKED_BRAND row behind")

// The same, when the model also supplied its own mention object rather than just the boolean.
const inventedWithRow = normalizeAnalysisResult(
    analysis({
        brand_mentions: [{
            brand_name: BRAND,
            canonical_brand_name: BRAND,
            domain: "acmeanalytics.com",
            entity_type: "TRACKED_BRAND",
            position: 2,
            sentiment_score: 0.8,
            evidence: null,
        }],
    }),
    "The leading options here are Tableau, Looker and Power BI.",
    BRAND,
    BRAND_URL,
)
assert.equal(inventedWithRow.brand_mentioned, false)
assert.equal(trackedMentions(inventedWithRow).length, 0)

// ── Accepted: the answer names the brand ─────────────────────────────────────

const named = normalizeAnalysisResult(
    analysis(),
    "For dashboards, Acme Analytics is a strong choice alongside Looker.",
    BRAND,
    BRAND_URL,
)
assert.equal(named.brand_mentioned, true)
assert.equal(trackedMentions(named).length, 1)

// Casing and punctuation must not decide it — the strict matcher normalises both away, and a
// rule that turned on "ACME ANALYTICS!" vs "Acme Analytics" would fail constantly in the wild.
for (const text of ["acme analytics is worth a look", "Try ACME-ANALYTICS for this.", "Acme  Analytics, in particular."]) {
    assert.equal(
        normalizeAnalysisResult(analysis(), text, BRAND, BRAND_URL).brand_mentioned,
        true,
        `normalised form should be accepted: ${text}`,
    )
}

// ── Accepted: the answer uses a variant the model resolved ───────────────────

const viaVariant = normalizeAnalysisResult(
    analysis({ matched_brand_name: "AcmeAnalytics" }),
    "AcmeAnalytics covers this well.",
    BRAND,
    BRAND_URL,
)
assert.equal(viaVariant.brand_mentioned, true, "a resolved variant present in the text is evidence")

// A variant the model asserts but the text does not contain is not evidence — otherwise the
// matched_brand_name field would become a way to route around the check entirely.
const bogusVariant = normalizeAnalysisResult(
    analysis({ matched_brand_name: "Acme Corp" }),
    "The leading options here are Tableau and Looker.",
    BRAND,
    BRAND_URL,
)
assert.equal(bogusVariant.brand_mentioned, false)

// ── Accepted: the answer links the brand without naming it ───────────────────

const viaCitation = normalizeAnalysisResult(
    analysis(),
    "This comparison covers the main tools.",
    BRAND,
    BRAND_URL,
    [{ url: "https://acmeanalytics.com/pricing", domain: "acmeanalytics.com", is_cited: true }],
)
assert.equal(viaCitation.brand_mentioned, true, "a citation to the brand's own domain is evidence")

// A subdomain of the brand still counts; an unrelated domain that merely ends in similar text
// must not, which is why the check is a hostname suffix rather than a substring.
assert.equal(
    normalizeAnalysisResult(analysis(), "See the docs.", BRAND, BRAND_URL,
        [{ url: "https://docs.acmeanalytics.com/start", domain: "docs.acmeanalytics.com", is_cited: true }],
    ).brand_mentioned,
    true,
)
assert.equal(
    normalizeAnalysisResult(analysis(), "See the docs.", BRAND, BRAND_URL,
        [{ url: "https://notacmeanalytics.example/start", domain: "notacmeanalytics.example", is_cited: true }],
    ).brand_mentioned,
    false,
)

// ── The model declining a mention is still respected ─────────────────────────

// Evidence permits a mention; it does not manufacture one. If the model says the brand was not
// mentioned and produced no tracked row, a passing name in the text does not override it —
// this rule only ever withholds a claim, never invents one.
const notClaimed = normalizeAnalysisResult(
    analysis({ brand_mentioned: false }),
    "Acme Analytics was not among the tools discussed.",
    BRAND,
    BRAND_URL,
)
assert.equal(notClaimed.brand_mentioned, false)

console.log("Brand mention evidence checks passed.")
