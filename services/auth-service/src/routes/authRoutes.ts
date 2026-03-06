import { Router } from 'express';
import authController from '../controllers/authController';
import { validate, sendOTPSchema, verifyOTPSchema } from '../middleware/validator';
import { authenticateJWT } from '../middleware/auth';
import { otpRateLimiter, apiRateLimiter, strictRateLimiter } from '@krishiai/shared/middleware/rateLimiter';

const router = Router();

// Public routes with rate limiting
// OTP endpoint: 5 requests per hour per phone (Requirement 1.5)
router.post('/send-otp', otpRateLimiter, validate(sendOTPSchema), authController.sendOTP);
router.post('/verify-otp', otpRateLimiter, validate(verifyOTPSchema), authController.verifyOTP);

// Protected routes with API rate limiting (1000 requests per hour per user)
router.get('/profile', authenticateJWT, apiRateLimiter, authController.getProfile);
router.post('/refresh', authenticateJWT, apiRateLimiter, authController.refreshToken);

// Logout with strict rate limiting (10 requests per hour per user)
router.post('/logout', authenticateJWT, strictRateLimiter, authController.logout);

export default router;
