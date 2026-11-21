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
import { meetingsRouter } from './modules/meetings/meetings.router';
import { notesRouter } from './modules/notes/notes.router';
import { dashboardRouter } from './modules/dashboard/dashboard.router';
import { contactsRouter } from './modules/contacts/contacts.router';
import { calendarRouter } from './modules/calendar/calendar.router';
import { attachmentsRouter } from './modules/attachments/attachments.router';
import { notificationsRouter } from './modules/notifications/notifications.router';
import { searchRouter } from './modules/search/search.router';
import { reportsRouter } from './modules/reports/reports.router';
import { authenticateJwt } from './common/middleware/auth.middleware';
import { MeetingsController } from './modules/meetings/meetings.controller';

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
  app.use('/api/v1/meetings', meetingsRouter);
  app.use('/api/v1/decisions', authenticateJwt, MeetingsController.getDecisions);
  app.use('/api/v1/notes', notesRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/contacts', contactsRouter);
  app.use('/api/v1/calendar', calendarRouter);
  app.use('/api/v1/attachments', attachmentsRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/reports', reportsRouter);

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
