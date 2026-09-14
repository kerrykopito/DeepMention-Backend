#!/usr/bin/env node
// Runs the Railway CLI with the environment its IaC engine actually needs.
//
// The problem this works around: `.railway/railway.ts` is evaluated by node, spawned by the
// Railway CLI. The `railway` npm SDK then checks the CLI's version by running whatever
// `process.env._` points at. On Windows under Git Bash, the shell overwrites `_` with the path
// of the command it is running, so the SDK ends up probing the wrong executable, fails to read
// a version, and reports "requires Railway CLI 5.42.1 or newer" - even with a much newer CLI
// installed. The message sends you off upgrading something that is already up to date.
//
// Setting `_` to the real railway binary before spawning makes the check succeed from any shell.
//
// Usage: npm run railway:plan     /     npm run railway:apply -- --yes

import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import process from "node:process"

function findRailwayExecutable() {
    const isWindows = process.platform === "win32"
    const binary = isWindows ? "railway.exe" : "railway"

    // The npm global install keeps the real binary here, next to the shim scripts.
    const candidates = [
        path.join(
            process.env.APPDATA ?? "",
            "npm",
            "node_modules",
            "@railway",
            "cli",
            "bin",
            binary
        ),
        path.join(process.env.HOME ?? "", ".npm-global", "lib", "node_modules", "@railway", "cli", "bin", binary),
        "/usr/local/lib/node_modules/@railway/cli/bin/" + binary,
    ]

    for (const candidate of candidates) {
        if (candidate && existsSync(candidate)) return candidate
    }

    // Fall back to whatever is on PATH. On platforms where `_` is already correct this is fine.
    return binary
}

const executable = findRailwayExecutable()
const args = process.argv.slice(2)

const result = spawnSync(executable, args, {
    stdio: "inherit",
    env: { ...process.env, _: executable },
})

if (result.error) {
    console.error(`Could not run the Railway CLI at ${executable}: ${result.error.message}`)
    console.error("Install it with: npm i -g @railway/cli")
    process.exit(1)
}

process.exit(result.status ?? 1)
