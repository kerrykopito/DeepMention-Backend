import { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import prisma from "../lib/prisma"
import { readAccessTokenCookie } from "../utils/auth_cookies"

export type AuthenticatedRequest = Request & {
    user: {
        id: string
        role?: "USER" | "ADMIN"
        account_type?: "SINGLE" | "AGENCY"
    }
}

type AccessTokenPayload = {
    sub?: string
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    // The Authorization header stays the primary source, so every existing client — and any
    // non-browser caller — is unaffected. The httpOnly `access_token` cookie is accepted as a
    // second source, including when a bearer token was sent but did not verify.
    const header = req.headers.authorization
    const bearerToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : ""
    const cookieToken = readAccessTokenCookie(req)

    // Both sources are tried, header first. Taking only the header when one is present would
    // let a STALE bearer token mask a perfectly valid cookie: browsers that logged in before
    // the cookie migration still had an expired token in localStorage, sent it on every
    // request, and got a 401 despite holding a fresh cookie — which bounced them to /login
    // immediately after a successful login.
    const candidates = [bearerToken, cookieToken].filter((value): value is string => Boolean(value))

    if (candidates.length === 0) {
        res.status(401).json({ error: "Missing authorization token" })
        return
    }

    try {
        let payload: AccessTokenPayload | null = null
        for (const candidate of candidates) {
            try {
                payload = jwt.verify(candidate, process.env.JWT_ACCESS_SECRET!, { algorithms: ["HS256"] }) as AccessTokenPayload
                if (payload?.sub) break
                payload = null
            } catch {
                // Try the next source; only fail once every candidate has been rejected.
                payload = null
            }
        }

        if (!payload?.sub) {
            res.status(401).json({ error: "Invalid authorization token" })
            return
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, role: true, is_verified: true, account_type: true },
        })

        if (!user) {
            res.status(401).json({ error: "Invalid user" })
            return
        }

        if (!user.is_verified) {
            res.status(403).json({ error: "Please verify your email before continuing" })
            return
        }

        ;(req as AuthenticatedRequest).user = { id: user.id, role: user.role, account_type: user.account_type }
        next()
    } catch (error) {
        res.status(401).json({ error: "Invalid or expired authorization token" })
    }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = (req as AuthenticatedRequest).user?.id
        if (!userId) {
            res.status(401).json({ error: "Authentication required" })
            return
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true }
        })

        if (!user) {
            res.status(401).json({ error: "Invalid user" })
            return
        }

        if (user.role !== "ADMIN") {
            res.status(403).json({ error: "Admin access required" })
            return
        }

        ;(req as AuthenticatedRequest).user = { id: user.id, role: user.role }
        next()
    } catch {
        res.status(500).json({ error: "Failed to verify admin access" })
    }
}
