import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../modules/auth/token.service';
import { sendError } from '../response';

export function authenticateJwt(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'UNAUTHORIZED', 'Authentication token is required.', 401);
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = TokenService.verifyAccessToken(token);

  if (!payload) {
    sendError(res, 'TOKEN_EXPIRED', 'Authentication token is invalid or expired.', 401);
    return;
  }

  req.user = payload;
  next();
}
