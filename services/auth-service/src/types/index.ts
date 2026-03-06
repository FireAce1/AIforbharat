export interface User {
  id: string;
  phone: string;
  name?: string;
  language: string;
  created_at: Date;
  last_active?: Date;
}

export interface OTPCode {
  id: string;
  phone: string;
  code: string;
  expires_at: Date;
  verified: boolean;
  created_at: Date;
}

export interface JWTPayload {
  userId: string;
  phone: string;
  iat?: number;
  exp?: number;
}

export interface SendOTPRequest {
  phone: string;
}

export interface VerifyOTPRequest {
  phone: string;
  code: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
  data?: {
    remainingAttempts?: number;
    expirySeconds?: number;
  };
}
