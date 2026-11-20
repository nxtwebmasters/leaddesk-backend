import { prisma } from '../../common/prisma';
import { NotificationsService } from '../notifications/notifications.service';

export class SchedulerWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  public static start(intervalMs: number = 60000) {
    if (this.timer) {
      console.log('Scheduler worker is already running.');
      return;
    }

    console.log('⏰ Starting LeadDesk Background Scheduler Worker (every 60s)...');
    // Run an initial tick shortly after startup
    setTimeout(() => this.tick(), 5000);
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('Scheduler worker stopped.');
    }
  }

  public static async tick() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await Promise.allSettled([
        this.checkUpcomingMeetings(),
        this.checkDailyKickoff(),
        this.checkFollowUpSweep(),
        this.checkPendingReminders(),
      ]);
    } catch (err) {
      console.error('Error during scheduler worker tick:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 15-Minute Pre-Meeting Alert
   */
  private static async checkUpcomingMeetings() {
    const now = new Date();
    const from = new Date(now.getTime() + 14 * 60 * 1000);
    const to = new Date(now.getTime() + 16 * 60 * 1000);

    const upcomingMeetings = await prisma.meeting.findMany({
      where: {
        status: 'SCHEDULED',
        startedAt: {
          gte: from,
          lte: to,
        },
      },
    });

    for (const meeting of upcomingMeetings) {
      // Check if reminder already dispatched
      const existing = await prisma.reminder.findFirst({
        where: {
          meetingId: meeting.id,
          status: 'SENT',
        },
      });

      if (!existing) {
        await NotificationsService.sendToUser(meeting.userId, {
          title: '📅 Meeting Starting in 15 Minutes',
          body: `${meeting.title} begins at ${meeting.startedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`,
          type: 'MEETING_ALERT',
          actionUrl: meeting.meetingUrl || '/meetings',
        });

        await prisma.reminder.create({
          data: {
            title: `15m Warning: ${meeting.title}`,
            remindAt: meeting.startedAt,
            status: 'SENT',
            sentAt: new Date(),
            userId: meeting.userId,
            meetingId: meeting.id,
          },
        });
      }
    }
  }

  /**
   * 9:00 AM Morning Kickoff Notification
   */
  private static async checkDailyKickoff() {
    const now = new Date();
    // Only fire during the 09:00 hour (first 5 minutes)
    if (now.getHours() !== 9 || now.getMinutes() > 5) return;

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const users = await prisma.user.findMany({ select: { id: true } });

    for (const u of users) {
      // Check if kickoff was already sent today
      const alreadySent = await prisma.appNotification.findFirst({
        where: {
          userId: u.id,
          type: 'DAILY_KICKOFF',
          createdAt: { gte: startOfToday },
        },
      });

      if (!alreadySent) {
        const [meetingCount, taskCount] = await Promise.all([
          prisma.meeting.count({
            where: {
              userId: u.id,
              status: 'SCHEDULED',
              startedAt: { gte: startOfToday, lte: endOfToday },
            },
          }),
          prisma.task.count({
            where: {
              userId: u.id,
              status: { in: ['INBOX', 'PLANNED', 'IN_PROGRESS'] },
              OR: [
                { priority: { in: ['URGENT', 'HIGH'] } },
                { dueAt: { lte: endOfToday } },
              ],
            },
          }),
        ]);

        await NotificationsService.sendToUser(u.id, {
          title: '☀️ Morning Leadership Kickoff',
          body: `Good morning! You have ${meetingCount} meeting(s) and ${taskCount} high-priority tasks planned for today.`,
          type: 'DAILY_KICKOFF',
          actionUrl: '/dashboard',
        });
      }
    }
  }

  /**
   * 5:00 PM End-of-Day Follow-Up Sweep
   */
  private static async checkFollowUpSweep() {
    const now = new Date();
    // Only fire during the 17:00 hour (first 5 minutes)
    if (now.getHours() !== 17 || now.getMinutes() > 5) return;

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const users = await prisma.user.findMany({ select: { id: true } });

    for (const u of users) {
      const alreadySent = await prisma.appNotification.findFirst({
        where: {
          userId: u.id,
          type: 'FOLLOWUP_SWEEP',
          createdAt: { gte: startOfToday },
        },
      });

      if (!alreadySent) {
        const pendingCount = await prisma.followUp.count({
          where: {
            userId: u.id,
            status: 'OPEN',
            nextFollowUpAt: { lte: endOfToday },
          },
        });

        if (pendingCount > 0) {
          await NotificationsService.sendToUser(u.id, {
            title: '🤝 EOD Follow-up Sweep',
            body: `You have ${pendingCount} stakeholder follow-up(s) waiting for closure before wrap-up.`,
            type: 'FOLLOWUP_SWEEP',
            actionUrl: '/followups',
          });
        }
      }
    }
  }

  /**
   * Dispatches custom due reminders
   */
  private static async checkPendingReminders() {
    const now = new Date();
    const pendingReminders = await prisma.reminder.findMany({
      where: {
        status: 'PENDING',
        remindAt: { lte: now },
      },
    });

    for (const r of pendingReminders) {
      await NotificationsService.sendToUser(r.userId, {
        title: '⏰ Reminder Alert',
        body: r.title,
        type: 'REMINDER',
        actionUrl: r.taskId ? '/tasks' : (r.meetingId ? '/meetings' : '/dashboard'),
      });

      await prisma.reminder.update({
        where: { id: r.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    }
  }
}
