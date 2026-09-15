import { Request, Response } from 'express'
import { z } from 'zod'
import { EMAIL_NOT_VERIFIED, refreshAccessToken, registerUser, resetPasswordWithOtp, sendForgotPasswordOtp, verifyUserOtp, login as loginService } from './auth_service'
import { clearAuthCookies, readRefreshTokenCookie, setAuthCookies } from '../../utils/auth_cookies'
import { EMAIL_DELIVERY_FAILED } from '../email/email_service'
import { getErrorCode, isDatabaseUnreachable, resolveErrorResponse } from '../../lib/http_error'

/** Messages auth_service throws deliberately for the client. Anything else is internal. */
const EXPECTED_AUTH_ERRORS = new Set([
    'User not found',
    'User is already verified',
    'Invalid OTP',
    'OTP has expired',
    'Only work/business email addresses are allowed.',
    'An account with this email already exists.',
    'email or password is incorrect',
    'please verify your email',
    'Invalid or expired OTP',
    'Invalid or expired refresh token',
    'Invalid refresh token',
    'Invalid refresh user',
])

function clientMessage(err: unknown, route: string, fallback: string): string {
    const message = err instanceof Error ? err.message : ''
    if (EXPECTED_AUTH_ERRORS.has(message)) return message
    console.error(`[auth_controller:${route}]`, err)
    return fallback
}

const registerSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    account_type: z.enum(['SINGLE', 'AGENCY'], {
        error: 'account_type must be SINGLE or AGENCY',
    }),
})

export async function register(req: Request, res: Response): Promise<void> {
    const parsed = registerSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors: parsed.error.flatten().fieldErrors,
        })
        return
    }

    try {
        const result = await registerUser(parsed.data)
        res.status(201).json({ success: true, ...result })
    } catch (err: unknown) {
        // The mail provider's own error text is not something to show a user, so this one
        // failure is recognised by its code and answered with a sentence of ours. Everything
        // else - the duplicate account, the personal-email rejection - now carries the status
        // it should be reported with, instead of being identified by a word in the sentence.
        if (getErrorCode(err) === EMAIL_DELIVERY_FAILED) {
            res.status(502).json({
                success: false,
                message: "We could not send your verification code right now. Please try again in a moment.",
            })
            return
        }

        const { status, message, unexpected } = resolveErrorResponse(err, 'Registration failed. Please try again.')
        if (unexpected) {
            console.error('[auth_controller:register]', err)
        }
        res.status(status).json({ success: false, message })
    }
}

const verifyOtpSchema = z.object({
    email: z.string().email('Invalid email format'),
    otp: z.string().length(6, 'OTP must be exactly 6 digits'),
})

export async function verifyOtp(req: Request, res: Response): Promise<void> {
    const parsed = verifyOtpSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors: parsed.error.flatten().fieldErrors,
        })
        return
    }

    try {
        const result = await verifyUserOtp(parsed.data.email, parsed.data.otp)
        setAuthCookies(res, result)
        res.status(200).json({ success: true, ...result })
    } catch (err: unknown) {
        res.status(400).json({ success: false, message: clientMessage(err, 'verifyOtp', 'Verification failed') })
    }
}

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
})

const forgotPasswordOtpSchema = z.object({
    email: z.string().email('Invalid email format'),
})

const resetPasswordSchema = z.object({
    email: z.string().email('Invalid email format'),
    otp: z.string().length(6, 'OTP must be exactly 6 digits'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
})

export async function login(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors: parsed.error.flatten().fieldErrors
        })
        return
    }
    try {
        const result = await loginService(parsed.data)
        setAuthCookies(res, result)
        res.status(200).json({ success: true, ...result })
    } catch (err: unknown) {
        // A login that never reached the database is not a rejected credential, and saying so
        // is not a leak: it reveals nothing about whether the account exists.
        if (isDatabaseUnreachable(err)) {
            res.status(503).json({ success: false, message: 'Database is currently unreachable. Please check database connection.' })
            return
        }
        // The unverified account is the single login failure answered with 403, and it is
        // identified by the code the service attaches rather than by its wording.
        if (getErrorCode(err) === EMAIL_NOT_VERIFIED) {
            res.status(403).json({ success: false, message: 'Please verify your email using the verification code sent to your inbox before logging in.' })
            return
        }
        // Everything else is 401 with a deliberately vague message, so that a wrong password
        // and an address with no account remain indistinguishable. The status a service may
        // have attached is ignored here on purpose, for the same reason.
        res.status(401).json({ success: false, message: clientMessage(err, 'login', 'Login failed') })
    }
}

export async function forgotPasswordSendOtp(req: Request, res: Response): Promise<void> {
    const parsed = forgotPasswordOtpSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors: parsed.error.flatten().fieldErrors,
        })
        return
    }

    try {
        const result = await sendForgotPasswordOtp(parsed.data.email)
        res.status(200).json({ success: true, ...result })
    } catch (err: unknown) {
        // Recognised by the same code as in register, since this is the same throw; only the
        // sentence shown to the user differs, because the two routes send different mail.
        const isEmailDeliveryError = getErrorCode(err) === EMAIL_DELIVERY_FAILED
        if (!isEmailDeliveryError) console.error('[auth_controller:forgotPasswordSendOtp]', err)
        res.status(isEmailDeliveryError ? 502 : 500).json({
            success: false,
            message: isEmailDeliveryError
                ? "We could not send your password reset code right now. Please try again in a moment."
                : 'Failed to send password reset code. Please try again.',
        })
    }
}

export async function forgotPasswordReset(req: Request, res: Response): Promise<void> {
    const parsed = resetPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors: parsed.error.flatten().fieldErrors,
        })
        return
    }

    try {
        const result = await resetPasswordWithOtp(parsed.data.email, parsed.data.otp, parsed.data.password)
        res.status(200).json({ success: true, ...result })
    } catch (err: unknown) {
        res.status(400).json({ success: false, message: clientMessage(err, 'forgotPasswordReset', 'Failed to reset password') })
    }
}

const refreshSchema = z.object({
    refresh_token: z.string().min(1),
})

export async function refresh(req: Request, res: Response): Promise<void> {
    // The body stays the primary source. A cookie-only client sends no body at all, so the
    // schema has to be allowed to fail before the cookie is consulted — hence the resolve-then-
    // validate order rather than an early return on a failed parse.
    const parsed = refreshSchema.safeParse(req.body)
    const refreshToken = parsed.success ? parsed.data.refresh_token : readRefreshTokenCookie(req)

    if (!refreshToken) {
        res.status(401).json({ success: false, message: 'Refresh token is required' })
        return
    }

    try {
        const tokens = await refreshAccessToken(refreshToken)
        setAuthCookies(res, tokens)
        res.status(200).json({ success: true, ...tokens })
    } catch (err: unknown) {
        // Deliberately does NOT clear the cookies: a transient database failure surfaces here
        // too, and dropping the session over one would log the user out for no reason.
        res.status(401).json({ success: false, message: clientMessage(err, 'refresh', 'Session expired') })
    }
}

/**
 * Clears the auth cookies. Intentionally unauthenticated and always 200 — logging out must
 * succeed even when the access token has already expired.
 */
export async function logout(_req: Request, res: Response): Promise<void> {
    clearAuthCookies(res)
    res.status(200).json({ success: true, message: 'Logged out' })
}
