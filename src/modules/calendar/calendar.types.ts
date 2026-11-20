import { z } from 'zod';

export const CalendarEventsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  types: z.string().optional(), // comma-separated: MEETING,TASK,FOLLOW_UP
});

export type CalendarEventsQuery = z.infer<typeof CalendarEventsQuerySchema>;

export const RescheduleEventInputSchema = z.object({
  entityType: z.enum(['MEETING', 'TASK', 'FOLLOW_UP']),
  entityId: z.string().uuid(),
  newDate: z.coerce.date(),
});

export type RescheduleEventInput = z.infer<typeof RescheduleEventInputSchema>;

export interface UnifiedCalendarEvent {
  id: string;
  type: 'MEETING' | 'TASK' | 'FOLLOW_UP' | 'PERSONAL';
  title: string;
  startAt: Date;
  endAt?: Date | null;
  status: string;
  allDay?: boolean;
  priority?: string | null;
  assigneeName?: string | null;
  contactName?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  description?: string | null;
}
