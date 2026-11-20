import { prisma } from '../../common/prisma';
import { CalendarEventsQuery, RescheduleEventInput, UnifiedCalendarEvent } from './calendar.types';

export class CalendarService {
  public static async getEvents(userId: string, query: CalendarEventsQuery): Promise<UnifiedCalendarEvent[]> {
    const now = new Date();
    const from = query.from || new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = query.to || new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

    const typeFilter = query.types ? query.types.split(',').map((t) => t.trim().toUpperCase()) : null;

    const includeMeetings = !typeFilter || typeFilter.includes('MEETING');
    const includeTasks = !typeFilter || typeFilter.includes('TASK');
    const includeFollowUps = !typeFilter || typeFilter.includes('FOLLOW_UP');

    const [meetings, tasks, followUps, personalEvents] = await Promise.all([
      includeMeetings
        ? prisma.meeting.findMany({
            where: {
              userId,
              startedAt: { gte: from, lte: to },
            },
            orderBy: { startedAt: 'asc' },
          })
        : [],
      includeTasks
        ? prisma.task.findMany({
            where: {
              userId,
              dueAt: { gte: from, lte: to },
            },
            orderBy: { dueAt: 'asc' },
          })
        : [],
      includeFollowUps
        ? prisma.followUp.findMany({
            where: {
              userId,
              nextFollowUpAt: { gte: from, lte: to },
            },
            orderBy: { nextFollowUpAt: 'asc' },
          })
        : [],
      prisma.calendarEvent.findMany({
        where: {
          userId,
          startAt: { gte: from, lte: to },
        },
        orderBy: { startAt: 'asc' },
      }),
    ]);

    const events: UnifiedCalendarEvent[] = [];

    for (const m of meetings) {
      events.push({
        id: m.id,
        type: 'MEETING',
        title: m.title,
        startAt: m.startedAt,
        endAt: m.endedAt,
        status: m.status,
        allDay: false,
        location: m.location,
        meetingUrl: m.meetingUrl,
        description: m.description,
      });
    }

    for (const t of tasks) {
      events.push({
        id: t.id,
        type: 'TASK',
        title: t.title,
        startAt: t.dueAt!,
        status: t.status,
        priority: t.priority,
        assigneeName: t.assigneeName,
        allDay: true,
        description: t.description,
      });
    }

    for (const f of followUps) {
      events.push({
        id: f.id,
        type: 'FOLLOW_UP',
        title: `Follow up: ${f.contactName} - ${f.subject}`,
        startAt: f.nextFollowUpAt,
        status: f.status,
        contactName: f.contactName,
        allDay: true,
        description: f.context,
      });
    }

    for (const p of personalEvents) {
      events.push({
        id: p.id,
        type: 'PERSONAL',
        title: p.title,
        startAt: p.startAt,
        endAt: p.endAt,
        status: 'CONFIRMED',
        allDay: p.allDay,
        description: p.description,
      });
    }

    events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return events;
  }

  public static async rescheduleEvent(userId: string, input: RescheduleEventInput) {
    const { entityType, entityId, newDate } = input;

    if (entityType === 'TASK') {
      const task = await prisma.task.findFirst({ where: { id: entityId, userId } });
      if (!task) return null;
      return prisma.task.update({
        where: { id: entityId },
        data: { dueAt: newDate },
      });
    }

    if (entityType === 'FOLLOW_UP') {
      const followUp = await prisma.followUp.findFirst({ where: { id: entityId, userId } });
      if (!followUp) return null;
      return prisma.followUp.update({
        where: { id: entityId },
        data: { nextFollowUpAt: newDate },
      });
    }

    if (entityType === 'MEETING') {
      const meeting = await prisma.meeting.findFirst({ where: { id: entityId, userId } });
      if (!meeting) return null;

      let newEndedAt = meeting.endedAt;
      if (meeting.endedAt && meeting.startedAt) {
        const durationMs = new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime();
        newEndedAt = new Date(new Date(newDate).getTime() + durationMs);
      }

      return prisma.meeting.update({
        where: { id: entityId },
        data: {
          startedAt: newDate,
          endedAt: newEndedAt,
        },
      });
    }

    return null;
  }

  public static async generateIcalFeed(userId: string): Promise<string> {
    const from = new Date();
    from.setDate(from.getDate() - 14); // 2 weeks in past

    const to = new Date();
    to.setDate(to.getDate() + 90); // 3 months in future

    const events = await this.getEvents(userId, { from, to });

    const formatIcalDate = (d: Date): string => {
      return new Date(d)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    };

    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LeadDesk//Personal Leadership OS//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:LeadDesk Agenda',
      'X-WR-TIMEZONE:UTC',
    ];

    for (const ev of events) {
      const dtstamp = formatIcalDate(new Date());
      const dtstart = formatIcalDate(ev.startAt);
      const dtend = ev.endAt ? formatIcalDate(ev.endAt) : dtstart;

      ics.push(
        'BEGIN:VEVENT',
        `UID:${ev.id}@leaddesk.local`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:[${ev.type}] ${ev.title.replace(/[\n\r]/g, ' ')}`,
        `STATUS:${ev.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'}`
      );

      if (ev.location) {
        ics.push(`LOCATION:${ev.location.replace(/[\n\r]/g, ' ')}`);
      }

      if (ev.description) {
        ics.push(`DESCRIPTION:${ev.description.replace(/[\n\r]/g, ' ')}`);
      }

      ics.push('END:VEVENT');
    }

    ics.push('END:VCALENDAR');
    return ics.join('\r\n');
  }
}
