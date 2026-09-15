#!/usr/bin/env node
/**
 * Type-check gate.
 *
 * This project had no tsconfig.json and so no type checking at all — `tsx` strips types without
 * reading them, so a wrong type reached production as easily as a right one. Adding the config
 * surfaced 29 errors across 12 files. They are all fixed; the quarantine below is empty and the
 * check is green on every file.
 *
 * The quarantine stays because it is the mechanism that let the gate land green in the first
 * place, and it is the right way to take on a batch of new errors (a dependency bump, a schema
 * change) without leaving the check red — a check that is red on arrival gets ignored.
 *
 * Two rules keep it honest rather than a dumping ground:
 *   - a file may only be listed with a reason, and
 *   - a listed file that no longer has errors fails the check, so entries cannot outlive the
 *     problem they describe.
 *
 * `tsconfig.json`'s own "exclude" cannot do this job: it trims the root file list, but
 * TypeScript still checks anything reachable through an import, which these all were.
 */

import { execFileSync } from "node:child_process"

/** file → why it is not yet fixed. Delete the entry when you fix it; the check enforces that. */
const QUARANTINE = new Map([])

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
    console.error(`\n${blocking.length} type error(s)${QUARANTINE.size ? " outside the quarantine" : ""}:\n`)
    for (const line of blocking) console.error("  " + line)
}

if (stale.length) {
    console.error("\nThese files are quarantined but no longer have errors. Remove them from")
    console.error("scripts/typecheck.mjs so the list keeps meaning something:\n")
    for (const file of stale) console.error("  " + file)
}

if (!blocking.length && !stale.length) {
    console.log(QUARANTINE.size
        ? `Type check passed. ${errors.length} known error(s) remain in ${QUARANTINE.size} quarantined file(s) — see scripts/typecheck.mjs.`
        : "Type check passed. No errors, and nothing quarantined.")
}

process.exit(blocking.length || stale.length ? 1 : 0)
