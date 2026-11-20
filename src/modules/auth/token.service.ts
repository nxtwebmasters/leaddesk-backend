import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env';
import { JwtUserPayload } from './auth.types';

export class TokenService {
  public static signAccessToken(payload: JwtUserPayload): string {
    const options: SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRY as unknown as SignOptions['expiresIn'],
    };
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
  }

  public static verifyAccessToken(token: string): JwtUserPayload | null {
    try {
      return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtUserPayload;
    } catch {
      return null;
    }
  }

  public static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  public static generateRefreshToken(): {
    rawToken: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    // Default 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    return { rawToken, tokenHash, expiresAt };
  }
}
