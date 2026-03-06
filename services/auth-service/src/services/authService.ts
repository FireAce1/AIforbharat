import jwt from 'jsonwebtoken';
import { config } from '../config';
import db, { queryOptimizer } from '../config/database';
import { PreparedStatements } from '../../shared/database/preparedStatements';
import logger from '../utils/logger';
import { logBusinessEvent } from '../../shared/utils/logger';
import { User, JWTPayload } from '../types';
import otpService from './otpService';

export class AuthService {
  async sendOTP(phone: string): Promise<void> {
    await otpService.generateAndSendOTP(phone);
  }

  async verifyOTP(phone: string, code: string): Promise<User> {
    await otpService.verifyOTP(phone, code);

    // Create or get user
    const user = await this.createOrGetUser(phone);
    
    return user;
  }

  async createOrGetUser(phone: string): Promise<User> {
    const client = await db.connect();
    
    try {
      // Check if user exists using prepared statement
      const stmt = PreparedStatements.AUTH.GET_USER_BY_PHONE;
      const existingUser = await queryOptimizer.query(
        stmt.text,
        [phone],
        { name: stmt.name }
      );

      if (existingUser.rows.length > 0) {
        // Update last_active using prepared statement
        const updateStmt = PreparedStatements.AUTH.UPDATE_USER_ACTIVITY;
        await queryOptimizer.query(
          updateStmt.text,
          [phone],
          { name: updateStmt.name }
        );
        return existingUser.rows[0];
      }

      // Create new user using prepared statement
      const createStmt = PreparedStatements.AUTH.CREATE_USER;
      const newUser = await queryOptimizer.query(
        createStmt.text,
        [phone, 'hi'],
        { name: createStmt.name }
      );

      // Log user registration event
      logBusinessEvent(logger, 'user_registration', {
        userId: newUser.rows[0].id,
        phone: phone.substring(0, 6) + '****', // Partially mask phone for security
      });
      
      return newUser.rows[0];
    } finally {
      client.release();
    }
  }

  generateJWT(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      phone: user.phone,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiry,
      algorithm: 'HS256',
    } as jwt.SignOptions);

    return token;
  }

  async getUserById(userId: string): Promise<User | null> {
    const stmt = PreparedStatements.AUTH.GET_USER_BY_ID;
    const result = await queryOptimizer.query(
      stmt.text,
      [userId],
      { name: stmt.name }
    );
    
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async getRemainingOTPAttempts(phone: string): Promise<number> {
    return await otpService.getRemainingAttempts(phone);
  }
}

export default new AuthService();
