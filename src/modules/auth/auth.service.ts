import bcrypt from 'bcryptjs';
import { prisma } from '../../common/prisma';
import { TokenService } from './token.service';

export class AuthService {
  public static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = TokenService.signAccessToken(payload);
    const { rawToken, tokenHash, expiresAt } = TokenService.generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const safeUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      timezone: user.timezone,
      createdAt: user.createdAt,
    };

    return {
      user: safeUser,
      accessToken,
      refreshToken: rawToken,
    };
  }

  public static async refresh(rawRefreshToken: string) {
    const tokenHash = TokenService.hashToken(rawRefreshToken);

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      return null;
    }

    // Check revocation and expiration
    if (tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      return null;
    }

    // Token rotation: Revoke old token and create a new one
    const { rawToken: newRawToken, tokenHash: newTokenHash, expiresAt } =
      TokenService.generateRefreshToken();

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          userId: tokenRecord.userId,
          tokenHash: newTokenHash,
          expiresAt,
        },
      }),
    ]);

    const payload = { userId: tokenRecord.user.id, email: tokenRecord.user.email };
    const newAccessToken = TokenService.signAccessToken(payload);

    return {
      accessToken: newAccessToken,
      refreshToken: newRawToken,
    };
  }

  public static async logout(rawRefreshToken?: string) {
    if (!rawRefreshToken) return;

    const tokenHash = TokenService.hashToken(rawRefreshToken);
    await prisma.refreshToken
      .update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      })
      .catch(() => {
        // Ignore if token not found
      });
  }

  public static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  public static async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, code: 'USER_NOT_FOUND', message: 'User not found.' };
    }

    const isMatch = await bcrypt.compare(currentPass, user.passwordHash);
    if (!isMatch) {
      return { success: false, code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' };
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPass, salt);

    // Update password and revoke all existing refresh tokens
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { success: true };
  }
}
