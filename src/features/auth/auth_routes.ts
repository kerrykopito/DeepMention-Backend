import { Router } from 'express'
import { forgotPasswordReset, forgotPasswordSendOtp, logout, refresh, register, verifyOtp, login } from './auth_controller'
import { authAttemptLimiter, authRouteLimiter, otpRequestLimiter } from '../../middleware/rate_limit'

const router = Router()

router.use(authRouteLimiter)

router.post('/register', otpRequestLimiter, register)
router.post('/verify', authAttemptLimiter, verifyOtp)
router.post('/login', authAttemptLimiter, login)
router.post('/forgot-password/send-otp', otpRequestLimiter, forgotPasswordSendOtp)
router.post('/forgot-password/reset', authAttemptLimiter, forgotPasswordReset)
router.post('/refresh', refresh)
router.post('/logout', logout)

export default router
