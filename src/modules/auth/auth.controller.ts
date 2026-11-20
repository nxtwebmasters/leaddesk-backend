import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { sendSuccess, sendError } from '../../common/response';
import { env } from '../../config/env';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export class AuthController {
  public static async login(req: Request, res: Response) {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid credentials supplied', 400, parseResult.error.errors);
    }

    const { email, password } = parseResult.data;
    const result = await AuthService.login(email, password);

    if (!result) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
    });
  }

  public static async refresh(req: Request, res: Response) {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!rawRefreshToken) {
      return sendError(res, 'UNAUTHORIZED', 'No refresh token provided.', 401);
    }

    const result = await AuthService.refresh(rawRefreshToken);
    if (!result) {
      res.clearCookie('refreshToken', { path: '/' });
      return sendError(res, 'TOKEN_EXPIRED', 'Refresh token is expired or revoked. Please log in again.', 401);
    }

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return sendSuccess(res, {
      accessToken: result.accessToken,
    });
  }

  public static async logout(req: Request, res: Response) {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (rawRefreshToken) {
      await AuthService.logout(rawRefreshToken);
    }

    res.clearCookie('refreshToken', { path: '/' });
    return sendSuccess(res, { message: 'Logged out successfully.' });
  }

  public static async getProfile(req: Request, res: Response) {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated.', 401);
    }

    const user = await AuthService.getProfile(req.user.userId);
    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User profile not found.', 404);
    }

    return sendSuccess(res, { user });
  }

  public static async changePassword(req: Request, res: Response) {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated.', 401);
    }

    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid password parameters.', 400, parseResult.error.errors);
    }

    const { currentPassword, newPassword } = parseResult.data;
    const result = await AuthService.changePassword(req.user.userId, currentPassword, newPassword);

    if (!result.success) {
      return sendError(res, result.code || 'BAD_REQUEST', result.message || 'Could not change password.', 400);
    }

    res.clearCookie('refreshToken', { path: '/' });
    return sendSuccess(res, { message: 'Password updated successfully. Please log in with your new password.' });
  }
}
