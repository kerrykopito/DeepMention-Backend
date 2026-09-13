import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import prisma from '../../lib/prisma'
import { isWorkEmail, generateOtp } from '../../utils/email'
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt'
import type { RegisterInput, RegisterResponse, LoginInput, LogEUResponse } from './auth_types'
import { sendVerificationOtpEmail } from '../email/email_service'
import { ensureFreeTrialSubscription, getEffectivePlanAccess } from '../subscription/entitlements'
import { awardCredits } from '../payments/credits_service'
import { signupBonusFor } from '../payments/credits_config'
import jwt from 'jsonwebtoken'

/** A real bcrypt hash of a random value, compared against when no account matches. */
const TIMING_EQUALISER_HASH = '$2b$10$tH3e8THL4wq4Kb2zqHJ2ouiz8eA6FPwidbQMy89YYe29wBRSL5t4G'

/**
 * Reads the HMAC key used to hash OTPs. Deliberately read per call rather than into a
 * module-level constant: `.env` is loaded by the side-effecting `src/lib/env` import, and
 * ESM evaluates imports before the importing module's body, so a top-level read can observe
 * an unset value even in a correctly configured process.
 *
 * Fails closed — an absent or blank secret throws rather than silently downgrading to an
 * unkeyed digest. The message is not in the controller's client-facing allowlist, so it is
 * logged server-side and surfaces to the caller only as a generic failure.
 */
function getOtpHashSecret(): string {
    const secret = process.env.OTP_HASH_SECRET?.trim()
    if (!secret) {
        throw new Error('OTP_HASH_SECRET is not configured; refusing to hash OTPs without a key.')
    }

    return secret
}

/**
 * OTPs are persisted as a keyed HMAC-SHA-256 digest, never in plaintext, so a leaked
 * `User.otp` row cannot be replayed as-is — and, because the digest is keyed, a 6-digit code
 * cannot be recovered by brute-forcing the small preimage space without also stealing
 * OTP_HASH_SECRET. HMAC rather than bcrypt is deliberate: codes are single-use, expire in
 * 10 minutes and the endpoints are rate limited, so the verify path stays cheap. The digest
 * is 64 hex chars and the column is TEXT, so no migration is required.
 */
function hashOtp(otp: string): string {
    return crypto.createHmac('sha256', getOtpHashSecret()).update(otp, 'utf8').digest('hex')
}

/** Constant-time compare of the stored OTP digest against a freshly hashed candidate. */
function otpMatches(storedHash: string | null | undefined, otp: string): boolean {
    if (!storedHash) return false

    const stored = Buffer.from(storedHash, 'utf8')
    const candidate = Buffer.from(hashOtp(otp), 'utf8')

    // timingSafeEqual throws on differing lengths. A length mismatch only means the stored
    // value is not a 64-char digest (e.g. a plaintext row written before hashing), which is
    // not a match. A same-length digest made with a different key still fails the compare.
    if (stored.length !== candidate.length) return false

    return crypto.timingSafeEqual(stored, candidate)
}

/** The only environments where the console OTP fallback may run. Anything else — including
 *  an unset or unrecognised NODE_ENV — is treated as production. */
const DEV_OTP_FALLBACK_ENVS = new Set(['development', 'test'])

/**
 * Fail-closed gate for the console OTP fallback. It requires BOTH an explicitly
 * non-production NODE_ENV and an explicit `EMAIL_DEV_OTP_FALLBACK=true` opt-in, so it can
 * never activate in production no matter how EMAIL_DEV_OTP_FALLBACK is set.
 */
function isDevOtpFallbackAllowed(): boolean {
    const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase()
    if (!nodeEnv || !DEV_OTP_FALLBACK_ENVS.has(nodeEnv)) return false

    return process.env.EMAIL_DEV_OTP_FALLBACK === 'true'
}


export async function verifyUserOtp(email: string, otp: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    if (!user) {
        throw new Error('User not found')
    }

    if (user.is_verified) {
        throw new Error('User is already verified')
    }

    if (!otpMatches(user.otp, otp)) {
        throw new Error('Invalid OTP')
    }

    if (!user.otp_expires_at || user.otp_expires_at < new Date()) {
        throw new Error('OTP has expired')
    }

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            is_verified: true,
            otp: null,
            otp_expires_at: null,
        },
        select: {
            id: true,
            email: true,
            account_type: true,
            role: true,
            plan: true,
            is_verified: true,
        },
    })

    await ensureFreeTrialSubscription(updatedUser.id)

    // Award signup bonus credits — only if this is a fresh verification (balance is 0)
    const currentUser = await prisma.user.findUnique({ where: { id: updatedUser.id }, select: { credits_balance: true } })
    const signupBonus = signupBonusFor(updatedUser.account_type)
    if ((currentUser?.credits_balance ?? 0) === 0) {
        await awardCredits(updatedUser.id, signupBonus, 'SIGNUP_BONUS', `${signupBonus} free trial credits on account verification`)
    }

    const access = await getEffectivePlanAccess(updatedUser.id)
    const finalUser = await prisma.user.findUnique({ where: { id: updatedUser.id }, select: { credits_balance: true } })

    const accessToken = generateAccessToken(updatedUser.id)
    const refreshToken = generateRefreshToken(updatedUser.id)

    return {
        message: 'Email verified successfully',
        user: { ...updatedUser, effective_plan: access.effective_plan, credits_balance: finalUser?.credits_balance ?? signupBonus },
        access_token: accessToken,
        refresh_token: refreshToken,
        accessToken,
        refreshToken,
    }
}


export async function registerUser(input: RegisterInput): Promise<RegisterResponse> {
    const email = input.email.trim().toLowerCase()
    const { password, account_type } = input

    // 1. Work email check
    if (!isWorkEmail(email)) {
        throw new Error('Only work/business email addresses are allowed.')
    }

    // 2. Duplicate check
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing?.is_verified) {
        throw new Error('An account with this email already exists.')
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const otp = generateOtp()
    // Only the digest is persisted; `otp` itself stays in memory and is what gets emailed.
    const otpHash = hashOtp(otp)
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

    // 5. Create or refresh an unverified user, then send OTP.
    const user = existing
        ? await prisma.user.update({
            where: { id: existing.id },
            data: {
                password: hashedPassword,
                account_type,
                is_verified: false,
                otp: otpHash,
                otp_expires_at: otpExpiresAt,
            },
            select: {
                id: true,
                email: true,
                account_type: true,
                role: true,
                plan: true,
                is_verified: true,
            },
        })
        : await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                account_type,
                is_verified: false,
                otp: otpHash,
                otp_expires_at: otpExpiresAt,
            },
            select: {
                id: true,
                email: true,
                account_type: true,
                role: true,
                plan: true,
                is_verified: true,
            },
        })

    try {
        await sendVerificationOtpEmail(email, otp)
    } catch (error) {
        if (!isDevOtpFallbackAllowed()) throw error

        console.warn(`[DEV-ONLY OTP FALLBACK — never runs in production] Could not send verification email to ${email}. Use OTP: ${otp}`)
    }

    return {
        message: 'Verification code sent.',
        user,
    }
}

export async function login(input: LoginInput): Promise<LogEUResponse> {
    const email = input.email.trim().toLowerCase()
    const { password } = input

    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            password: true,
            account_type: true,
            role: true,
            plan: true,
            credits_balance: true,
            is_verified: true,
        }
    })
    // Unknown address and wrong password answer identically, so neither the message nor the
    // response time reveals whether an account exists. The dummy compare keeps the timing of
    // the two paths comparable, since skipping bcrypt entirely returns noticeably faster.
    const isPasswordValid = await bcrypt.compare(password, user?.password ?? TIMING_EQUALISER_HASH)
    if (!user || !isPasswordValid) {
        throw new Error("email or password is incorrect")
    }
    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken(user.id)
    if (!user.is_verified) {
        throw new Error("please verify your email")
    }
    await ensureFreeTrialSubscription(user.id)
    const access = await getEffectivePlanAccess(user.id)
    return {
        message: "welcome back",
        user: {
            id: user.id,
            email: user.email,
            account_type: user.account_type,
            role: user.role,
            plan: user.plan,
            effective_plan: access.effective_plan,
            is_verified: user.is_verified,
            credits_balance: user.credits_balance,
        },
        access_token: accessToken,
        refresh_token: refreshToken
    }
}

export async function sendForgotPasswordOtp(email: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, is_verified: true },
    })

    if (!user?.is_verified) {
        return { message: "If this account exists, an OTP has been sent." }
    }

    const otp = generateOtp()
    // Only the digest is persisted; `otp` itself stays in memory and is what gets emailed.
    const otpHash = hashOtp(otp)
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.user.update({
        where: { id: user.id },
        data: {
            otp: otpHash,
            otp_expires_at: otpExpiresAt,
        },
    })

    try {
        await sendVerificationOtpEmail(normalizedEmail, otp)
    } catch (error) {
        if (!isDevOtpFallbackAllowed()) throw error

        console.warn(`[DEV-ONLY OTP FALLBACK — never runs in production] Could not send password reset OTP to ${normalizedEmail}. Use OTP: ${otp}`)
    }

    return { message: "If this account exists, an OTP has been sent." }
}

export async function resetPasswordWithOtp(email: string, otp: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    if (!user || !user.is_verified) {
        throw new Error("Invalid or expired OTP")
    }

    if (!otpMatches(user.otp, otp)) {
        throw new Error("Invalid or expired OTP")
    }

    if (!user.otp_expires_at || user.otp_expires_at < new Date()) {
        throw new Error("Invalid or expired OTP")
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            otp: null,
            otp_expires_at: null,
        },
    })

    return { message: "Password updated successfully" }
}

export async function refreshAccessToken(refreshToken: string) {
    let payload: { sub?: string }
    try {
        payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!, { algorithms: ["HS256"] }) as { sub?: string }
    } catch {
        throw new Error('Invalid or expired refresh token')
    }

    if (!payload.sub) throw new Error('Invalid refresh token')

    const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, is_verified: true }
    })

    if (!user || !user.is_verified) throw new Error('Invalid refresh user')

    return {
        access_token: generateAccessToken(user.id),
        refresh_token: generateRefreshToken(user.id),
    }
}
