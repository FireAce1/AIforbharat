import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';
import { SendOTPRequest, VerifyOTPRequest, AuthResponse } from '../types';
import { AuthRequest, blacklistToken } from '../middleware/auth';
import logger from '../utils/logger';

export class AuthController {
  async sendOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone } = req.body as SendOTPRequest;

      await authService.sendOTP(phone);

      const remainingAttempts = await authService.getRemainingOTPAttempts(phone);

      const response: AuthResponse = {
        success: true,
        message: 'OTP sent successfully',
        data: {
          remainingAttempts,
          expirySeconds: 300,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, code } = req.body as VerifyOTPRequest;

      const user = await authService.verifyOTP(phone, code);
      const token = authService.generateJWT(user);

      const response: AuthResponse = {
        success: true,
        message: 'OTP verified successfully',
        token,
        user,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const user = await authService.getUserById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const user = await authService.getUserById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Generate new token with sliding expiration (7 days from now)
      const token = authService.generateJWT(user);

      // Optionally blacklist the old token to prevent reuse
      if (req.token && req.user.exp) {
        try {
          await blacklistToken(req.token, req.user.exp);
          logger.info(`Old token blacklisted for user: ${user.id}`);
        } catch (error) {
          // Log but don't fail the refresh if blacklisting fails
          logger.error('Failed to blacklist old token during refresh:', error);
        }
      }

      const response: AuthResponse = {
        success: true,
        message: 'Token refreshed successfully',
        token,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.token) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      // Blacklist the current token
      if (req.user.exp) {
        await blacklistToken(req.token, req.user.exp);
        logger.info(`User logged out: ${req.user.userId}`);
      }

      const response: AuthResponse = {
        success: true,
        message: 'Logged out successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
