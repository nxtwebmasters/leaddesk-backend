import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { sendError } from './common/response';
import { healthRouter } from './modules/health/health.router';
import { authRouter } from './modules/auth/auth.router';
import { inboxRouter } from './modules/inbox/inbox.router';
import { tasksRouter } from './modules/tasks/tasks.router';
import { followupsRouter } from './modules/followups/followups.router';

export function createApp(): Application {
  const app = express();

  // Security & Core Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Base API v1 Routes
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/inbox', inboxRouter);
  app.use('/api/v1/tasks', tasksRouter);
  app.use('/api/v1/followups', followupsRouter);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    return sendError(res, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404);
  });

  // Global Error Handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    return sendError(
      res,
      'INTERNAL_SERVER_ERROR',
      env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
      500
    );
  });

  return app;
}
