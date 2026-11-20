import { TaskStatus, FollowUpStatus, InboxItemStatus } from '@prisma/client';
import { prisma } from '../../common/prisma';

export class DashboardService {
  private static getDayBounds(dateObj?: Date) {
    const base = dateObj ? new Date(dateObj) : new Date();
    const startOfDay = new Date(base);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(base);
    endOfDay.setHours(23, 59, 59, 999);

    return { startOfDay, endOfDay, now: new Date() };
  }

  public static async getMetrics(userId: string) {
    const { startOfDay, endOfDay, now } = this.getDayBounds();

    const activeTaskStatuses: TaskStatus[] = [
      TaskStatus.INBOX,
      TaskStatus.PLANNED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.WAITING,
    ];

    const activeFollowUpStatuses: FollowUpStatus[] = [
      FollowUpStatus.OPEN,
      FollowUpStatus.WAITING,
    ];

    const [
      inboxCount,
      overdueTasks,
      tasksDueTodayCount,
      tasksCompletedTodayCount,
      waitingTasks,
      followUpsDue,
      meetingsToday,
      recentDecisions,
    ] = await Promise.all([
      // 1. Unprocessed inbox items
      prisma.inboxItem.count({
        where: {
          userId,
          status: InboxItemStatus.NEW,
        },
      }),

      // 2. Overdue active tasks
      prisma.task.findMany({
        where: {
          userId,
          status: { in: activeTaskStatuses },
          dueAt: { lt: now },
        },
        orderBy: { dueAt: 'asc' },
        take: 5,
        select: {
          id: true,
          title: true,
          priority: true,
          type: true,
          status: true,
          dueAt: true,
          assigneeName: true,
        },
      }),

      // 3. Tasks due today
      prisma.task.count({
        where: {
          userId,
          status: { in: activeTaskStatuses },
          dueAt: { gte: startOfDay, lte: endOfDay },
        },
      }),

      // 4. Tasks completed today
      prisma.task.count({
        where: {
          userId,
          completedAt: { gte: startOfDay, lte: endOfDay },
        },
      }),

      // 5. Tasks in WAITING status (Waiting for team, client, approval)
      prisma.task.findMany({
        where: {
          userId,
          status: TaskStatus.WAITING,
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          assigneeName: true,
          priority: true,
          dueAt: true,
          updatedAt: true,
        },
      }),

      // 6. Follow-ups due today or overdue
      prisma.followUp.findMany({
        where: {
          userId,
          status: { in: activeFollowUpStatuses },
          nextFollowUpAt: { lte: endOfDay },
        },
        orderBy: { nextFollowUpAt: 'asc' },
        take: 5,
        select: {
          id: true,
          contactName: true,
          subject: true,
          status: true,
          nextFollowUpAt: true,
        },
      }),

      // 7. Today's meetings
      prisma.meeting.findMany({
        where: {
          userId,
          startedAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { startedAt: 'asc' },
        select: {
          id: true,
          title: true,
          startedAt: true,
          endedAt: true,
          status: true,
          location: true,
          meetingUrl: true,
          _count: {
            select: { actions: true, decisions: true },
          },
        },
      }),

      // 8. 5 Most recent decisions
      prisma.decision.findMany({
        where: {
          meeting: { userId },
        },
        orderBy: { decidedAt: 'desc' },
        take: 5,
        include: {
          meeting: {
            select: { id: true, title: true },
          },
        },
      }),
    ]);

    const overdueTasksCount = await prisma.task.count({
      where: {
        userId,
        status: { in: activeTaskStatuses },
        dueAt: { lt: now },
      },
    });

    const overdueFollowUpsCount = await prisma.followUp.count({
      where: {
        userId,
        status: { in: activeFollowUpStatuses },
        nextFollowUpAt: { lt: startOfDay },
      },
    });

    return {
      counts: {
        inbox: inboxCount,
        overdueTasks: overdueTasksCount,
        tasksDueToday: tasksDueTodayCount,
        tasksCompletedToday: tasksCompletedTodayCount,
        waitingTasks: waitingTasks.length,
        followUpsDue: followUpsDue.length,
        overdueFollowUps: overdueFollowUpsCount,
        meetingsToday: meetingsToday.length,
      },
      overdueTasks,
      waitingTasks,
      followUpsDue,
      meetingsToday,
      recentDecisions,
    };
  }

  public static async getMyDay(userId: string, targetDateStr?: string) {
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    const { startOfDay, endOfDay } = this.getDayBounds(targetDate);

    const activeTaskStatuses: TaskStatus[] = [
      TaskStatus.INBOX,
      TaskStatus.PLANNED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.WAITING,
    ];

    // Fetch top 3 priorities (Urgent/High tasks, or tasks due today)
    const topPriorities = await prisma.task.findMany({
      where: {
        userId,
        status: { in: activeTaskStatuses },
        OR: [
          { dueAt: { gte: startOfDay, lte: endOfDay } },
          { priority: 'URGENT' },
          { priority: 'HIGH' },
        ],
      },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
      take: 3,
      select: {
        id: true,
        title: true,
        priority: true,
        type: true,
        status: true,
        dueAt: true,
        assigneeName: true,
      },
    });

    // Fetch meetings today
    const meetings = await prisma.meeting.findMany({
      where: {
        userId,
        startedAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { startedAt: 'asc' },
      select: {
        id: true,
        title: true,
        startedAt: true,
        endedAt: true,
        location: true,
        meetingUrl: true,
        status: true,
      },
    });

    // Fetch tasks due today
    const tasksDue = await prisma.task.findMany({
      where: {
        userId,
        dueAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { dueAt: 'asc' },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        dueAt: true,
        assigneeName: true,
      },
    });

    // Fetch followups due today
    const followupsDue = await prisma.followUp.findMany({
      where: {
        userId,
        nextFollowUpAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { nextFollowUpAt: 'asc' },
      select: {
        id: true,
        contactName: true,
        subject: true,
        status: true,
        nextFollowUpAt: true,
      },
    });

    // Combine into a chronological timeline
    const timeline = [
      ...meetings.map((m) => ({
        id: m.id,
        type: 'MEETING' as const,
        time: m.startedAt,
        title: m.title,
        status: m.status,
        meta: { location: m.location, meetingUrl: m.meetingUrl, endedAt: m.endedAt },
      })),
      ...tasksDue.map((t) => ({
        id: t.id,
        type: 'TASK' as const,
        time: t.dueAt || startOfDay,
        title: t.title,
        status: t.status,
        meta: { priority: t.priority, assigneeName: t.assigneeName },
      })),
      ...followupsDue.map((f) => ({
        id: f.id,
        type: 'FOLLOW_UP' as const,
        time: f.nextFollowUpAt,
        title: `Follow up with ${f.contactName}: ${f.subject}`,
        status: f.status,
        meta: { contactName: f.contactName },
      })),
    ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return {
      date: startOfDay.toISOString(),
      topPriorities,
      timeline,
    };
  }
}
