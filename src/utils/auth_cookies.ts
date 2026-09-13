import type { CookieOptions, Request, Response } from 'express'

export const ACCESS_TOKEN_COOKIE = 'access_token'
export const REFRESH_TOKEN_COOKIE = 'refresh_token'

/**
 * The frontend (www.deepmention.xyz) and this API (api.deepmention.xyz) are subdomains of the
 * same registrable domain, so a parent-domain cookie is readable by both and — being
 * same-site — is still sent on the frontend's XHR under SameSite=Lax. Locally the two run on
 * different localhost ports, which is also same-site, so no domain is needed there.
 */
const PRODUCTION_COOKIE_DOMAIN = '.deepmention.xyz'

/** Mirrors the `?? '12h' / '30d'` defaults in utils/jwt.ts, so an unset env var still lines up. */
const FALLBACK_ACCESS_TTL_SECONDS = 12 * 60 * 60
const FALLBACK_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60

const SECONDS_PER_UNIT: Record<string, number> = {
    ms: 1 / 1000,
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
    w: 7 * 24 * 60 * 60,
}

function isProduction(): boolean {
    return process.env.NODE_ENV === 'production'
}

/**
 * Converts a jsonwebtoken `expiresIn` string ('1h', '30d', '900') into seconds, so the cookie
 * expires alongside the token it carries rather than on a second, hand-maintained constant.
 *
 * Deliberately kept out of the token-signing path: jsonwebtoken parses these strings itself,
 * and a value this parser does not recognise must degrade to a slightly-off cookie lifetime,
 * never to a wrongly-signed (or unsignable) token.
 */
function parseTtlSeconds(value: string | undefined, fallbackSeconds: number): number {
    const raw = value?.trim()
    if (!raw) return fallbackSeconds

    const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/i.exec(raw)
    if (!match) return fallbackSeconds

    const amount = Number(match[1])
    if (!Number.isFinite(amount) || amount <= 0) return fallbackSeconds

    const seconds = Math.floor(amount * SECONDS_PER_UNIT[(match[2] ?? 's').toLowerCase()])
    return seconds > 0 ? seconds : fallbackSeconds
}

export function accessTokenTtlSeconds(): number {
    return parseTtlSeconds(process.env.JWT_ACCESS_EXPIRES_IN, FALLBACK_ACCESS_TTL_SECONDS)
}

export function refreshTokenTtlSeconds(): number {
    return parseTtlSeconds(process.env.JWT_REFRESH_EXPIRES_IN, FALLBACK_REFRESH_TTL_SECONDS)
}

/**
 * The single source of truth for how auth cookies are scoped. `clearCookie` only deletes a
 * cookie whose domain and path match the ones it was set with, so both set and clear read
 * from here.
 */
function baseCookieOptions(): CookieOptions {
    return {
        httpOnly: true,
        // `secure` would make the cookie unusable over plain http://localhost in development.
        secure: isProduction(),
        // 'lax' rather than 'strict': the two hosts are same-site, so XHR still carries the
        // cookie, while a top-level navigation arriving from an external link keeps the session.
        sameSite: 'lax',
        path: '/',
        ...(isProduction() ? { domain: PRODUCTION_COOKIE_DOMAIN } : {}),
    }
}

type IssuedTokens = {
    access_token?: string | null
    refresh_token?: string | null
}

/**
 * Mirrors freshly issued tokens into httpOnly cookies. The same tokens are still returned in
 * the JSON body — clients that have not migrated keep working, and the cookie is simply a
 * second, script-unreadable copy.
 */
export function setAuthCookies(res: Response, tokens: IssuedTokens): void {
    const options = baseCookieOptions()

    if (tokens.access_token) {
        res.cookie(ACCESS_TOKEN_COOKIE, tokens.access_token, {
            ...options,
            maxAge: accessTokenTtlSeconds() * 1000,
        })
    }

    if (tokens.refresh_token) {
        res.cookie(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
            ...options,
            maxAge: refreshTokenTtlSeconds() * 1000,
        })
    }
}

export function clearAuthCookies(res: Response): void {
    const options = baseCookieOptions()
    res.clearCookie(ACCESS_TOKEN_COOKIE, options)
    res.clearCookie(REFRESH_TOKEN_COOKIE, options)
}

/**
 * Minimal RFC 6265 cookie-header parser. `cookie-parser` is not a dependency of this project
 * and reading two known names does not justify adding one.
 */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
    // Null-prototype: a request carrying `__proto__=...` or `constructor=...` then lands as an
    // ordinary key instead of touching the object's prototype chain.
    const cookies: Record<string, string> = Object.create(null)
    if (!header) return cookies

    for (const pair of header.split(';')) {
        const separator = pair.indexOf('=')
        if (separator < 1) continue

        const name = pair.slice(0, separator).trim()
        // First occurrence wins, matching how cookie-parser and the browsers resolve duplicates.
        if (!name || Object.prototype.hasOwnProperty.call(cookies, name)) continue

        let value = pair.slice(separator + 1).trim()
        if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1)
        }

        try {
            cookies[name] = decodeURIComponent(value)
        } catch {
            // A malformed percent-escape is not worth discarding the whole request over.
            cookies[name] = value
        }
    }

    return cookies
}

function readCookie(req: Request, name: string): string | undefined {
    // Honour cookie-parser's `req.cookies` if it is ever mounted, so this keeps working then.
    const parsed = (req as Request & { cookies?: Record<string, unknown> }).cookies
    const fromParser = parsed?.[name]
    if (typeof fromParser === 'string' && fromParser) return fromParser

    const value = parseCookieHeader(req.headers.cookie)[name]
    return value ? value : undefined
}

export function readAccessTokenCookie(req: Request): string | undefined {
    return readCookie(req, ACCESS_TOKEN_COOKIE)
}

export function readRefreshTokenCookie(req: Request): string | undefined {
    return readCookie(req, REFRESH_TOKEN_COOKIE)
}
