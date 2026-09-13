import { Request, Response } from 'express'
import { z } from 'zod'
import { refreshAccessToken, registerUser, resetPasswordWithOtp, sendForgotPasswordOtp, verifyUserOtp, login as loginService } from './auth_service'
import { clearAuthCookies, readRefreshTokenCookie, setAuthCookies } from '../../utils/auth_cookies'

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
        const message = err instanceof Error ? err.message : 'Registration failed'
        const isEmailDeliveryError = message.includes('Brevo email send failed')
        const status =
            message.includes('already exists') ? 409
                : message.includes('work/business') ? 422
                    : isEmailDeliveryError ? 502
                    : 500
        if (status === 500) {
            console.error('[auth_controller:register]', err)
            res.status(500).json({ success: false, message: 'Registration failed. Please try again.' })
            return
        }
        res.status(status).json({
            success: false,
            message: isEmailDeliveryError
                ? "We could not send your verification code right now. Please try again in a moment."
                : message,
        })
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
        const message = err instanceof Error ? err.message : 'Login failed'
        if (message.includes("Can't reach database") || message.includes("DatabaseNotReachable") || message.includes("P1001")) {
            res.status(503).json({ success: false, message: 'Database is currently unreachable. Please check database connection.' })
            return
        }
        if (message.toLowerCase().includes('verify your email')) {
            res.status(403).json({ success: false, message: 'Please verify your email using the verification code sent to your inbox before logging in.' })
            return
        }
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
        const message = err instanceof Error ? err.message : 'Failed to send password reset OTP'
        const isEmailDeliveryError = message.includes('Brevo email send failed')
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
