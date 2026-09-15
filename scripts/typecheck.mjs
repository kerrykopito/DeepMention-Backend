#!/usr/bin/env node
/**
 * Type-check gate.
 *
 * This project had no tsconfig.json and so no type checking at all — `tsx` strips types without
 * reading them, so a wrong type reached production as easily as a right one. Adding the config
 * surfaced 29 errors across 12 files, none of them new.
 *
 * Failing on all 29 from day one would make the check red on arrival, and a check that is red on
 * arrival gets ignored. So this wrapper fails only on errors OUTSIDE the quarantine below, which
 * makes every new type error a hard failure while the existing backlog is worked down.
 *
 * Two things keep the quarantine honest rather than a dumping ground:
 *   - a file may only be listed here with a reason, and
 *   - a listed file that no longer has errors fails the check, so the list shrinks as things are
 *     fixed instead of outliving the problem.
 *
 * `tsconfig.json`'s own "exclude" cannot do this job: it trims the root file list, but TypeScript
 * still checks anything reachable through an import, which every one of these is.
 */

import { execFileSync } from "node:child_process"

/** file → why it is not yet fixed. Delete the entry when you fix it; the check enforces that. */
const QUARANTINE = new Map([
    ["src/features/agency/agency_portal_service.ts",
        "Queries Run for created_at/score/responses and the Seo snapshots for domain/created_at/metrics_json/keywords_json. None of those columns exist — the schema has target_domain, fetched_at, payload. This view has never run against the current schema. It is the Agency Portal, which the sidebar already marks unavailable."],
    ["src/features/agency/agency_service.ts",
        "Reads primary_keyword and title off rows whose select does not include them."],
    ["src/features/campaigns/email/email_campaign_controller.ts",
        "Route params typed string | string[] passed as string. The feature has no frontend."],
    ["src/features/demo/demo_controller.ts",
        "DemoInput does not accept the optional fields passed to it."],
    ["src/features/exports/export_service.ts",
        "exceljs/pptxgenjs option names the installed versions do not have (tabColor, fontSize, a partial WorkbookView)."],
    ["src/features/llm/integration_test.ts",
        "Manual test script; findUnique called with a non-unique where."],
    ["src/features/prompts/prompt_controller.ts",
        "Calls deletePrompt, which exists nowhere. No route reaches that handler, so it is unreachable rather than broken."],
    ["src/scripts/backfill_forum_sources.ts", "One-off script; createMany input shape drifted from the schema."],
    ["src/scripts/check_scrape_runtime.ts", "One-off script; calls ping() on the narrowed Redis interface."],
    ["src/scripts/disable_all_projects.ts", "One-off script; references a ScrapeJobStatus.COMPLETED that does not exist."],
    ["src/scripts/restrict_scheduled_projects.ts", "One-off script; passes a wider PromptStatus than the callee accepts."],
    ["src/scripts/seed_promptpulse_demo.ts", "Seed script; findUnique called with a non-unique where."],
])

let output = ""
try {
    execFileSync("npx", ["tsc", "--noEmit", "-p", "."], { encoding: "utf8", stdio: "pipe", shell: true })
} catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`
}

const errors = output.split(/\r?\n/).filter(line => /error TS\d+/.test(line))
const fileOf = line => (line.match(/^(.+?)\(\d+,\d+\)/)?.[1] ?? "").replace(/\\/g, "/")

const blocking = errors.filter(line => !QUARANTINE.has(fileOf(line)))
const seen = new Set(errors.map(fileOf))
const stale = [...QUARANTINE.keys()].filter(file => !seen.has(file))

if (blocking.length) {
    console.error(`\n${blocking.length} type error(s) outside the quarantine:\n`)
    for (const line of blocking) console.error("  " + line)
}

if (stale.length) {
    console.error("\nThese files are quarantined but no longer have errors. Remove them from")
    console.error("scripts/typecheck.mjs so the list keeps meaning something:\n")
    for (const file of stale) console.error("  " + file)
}

if (!blocking.length && !stale.length) {
    const quarantined = errors.length
    console.log(`Type check passed. ${quarantined} known error(s) remain in ${QUARANTINE.size} quarantined file(s) — see scripts/typecheck.mjs.`)
}

process.exit(blocking.length || stale.length ? 1 : 0)
