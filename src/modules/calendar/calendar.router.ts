import { Router } from 'express';
import { authenticateJwt } from '../../common/middleware/auth.middleware';
import { CalendarController } from './calendar.controller';

const router = Router();

// iCal subscription feed (supports ?token= query param for calendar clients)
router.get('/feed.ics', CalendarController.getIcalFeed);

// Protected endpoints
router.get('/events', authenticateJwt, CalendarController.getEvents);
router.post('/reschedule', authenticateJwt, CalendarController.rescheduleEvent);

export { router as calendarRouter };
