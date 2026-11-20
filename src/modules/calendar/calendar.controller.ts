import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response';
import { CalendarService } from './calendar.service';
import { CalendarEventsQuerySchema, RescheduleEventInputSchema } from './calendar.types';
import { TokenService } from '../auth/token.service';

export class CalendarController {
  public static async getEvents(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const parsed = CalendarEventsQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid calendar query', 400, parsed.error.format());
      }

      const events = await CalendarService.getEvents(userId, parsed.data);
      return sendSuccess(res, { events, count: events.length });
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve calendar events', 500);
    }
  }

  public static async rescheduleEvent(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const parsed = RescheduleEventInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid reschedule payload', 400, parsed.error.format());
      }

      const updated = await CalendarService.rescheduleEvent(userId, parsed.data);
      if (!updated) {
        return sendError(res, 'NOT_FOUND', 'Event or entity not found', 404);
      }

      return sendSuccess(res, updated);
    } catch (error) {
      console.error('Error rescheduling calendar event:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to reschedule event', 500);
    }
  }

  public static async getIcalFeed(req: Request, res: Response) {
    try {
      let userId: string | null = req.user ? req.user.userId : null;

      // Also allow subscription token via query parameter ?token=...
      if (!userId && req.query['token']) {
        const payload = TokenService.verifyAccessToken(String(req.query['token']));
        if (payload) {
          userId = payload.userId;
        } else {
          return res.status(401).send('Invalid or expired calendar feed token');
        }
      }

      if (!userId) {
        return res.status(401).send('Authentication required for iCal feed');
      }

      const ics = await CalendarService.generateIcalFeed(userId);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="leaddesk-calendar.ics"');
      return res.status(200).send(ics);
    } catch (error) {
      console.error('Error generating iCal feed:', error);
      return res.status(500).send('Error generating calendar feed');
    }
  }
}
