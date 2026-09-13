import rateLimit, { ipKeyGenerator } from "express-rate-limit"
import type { Request } from "express"

function emailOf(req: Request): string {
    const email = (req.body as { email?: unknown } | undefined)?.email
    return typeof email === "string" ? email.trim().toLowerCase() : ""
}

/** Credential-guessing protection: an attacker rotating IPs still shares the email bucket. */
function ipAndEmailKey(req: Request): string {
    return `${ipKeyGenerator(req.ip ?? "")}|${emailOf(req)}`
}

const TOO_MANY = { error: "Too many attempts. Please wait a few minutes and try again." }

/** Guards OTP and password checks, where each request is a guess at a secret. */
export const authAttemptLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    keyGenerator: ipAndEmailKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: TOO_MANY,
})

/** Guards endpoints that send email, so they can't be used to flood an inbox. */
export const otpRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    keyGenerator: ipAndEmailKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: TOO_MANY,
})

/** Broad ceiling for the rest of the auth surface. */
export const authRouteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? ""),
    standardHeaders: true,
    legacyHeaders: false,
    message: TOO_MANY,
})
