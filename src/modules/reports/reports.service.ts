import { prisma } from '../../common/prisma';
import {
  WeeklyDigestData,
  DigestMetrics,
  DigestTaskItem,
  DigestDecisionItem,
  DigestMeetingItem,
  DigestFollowUpItem,
} from './reports.types';

export class ReportsService {
  private static getWeekRange(startDateStr?: string, endDateStr?: string): { start: Date; end: Date } {
    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { start, end };
      }
    }

    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday
    const diffToMonday = (day === 0 ? -6 : 1) - day;

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { start: monday, end: sunday };
  }

  static async generateWeeklyDigest(
    userId: string,
    startDateStr?: string,
    endDateStr?: string
  ): Promise<WeeklyDigestData> {
    const { start, end } = this.getWeekRange(startDateStr, endDateStr);

    // Next week window for upcoming items
    const nextWeekStart = new Date(end.getTime() + 1);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 7);
    nextWeekEnd.setHours(23, 59, 59, 999);

    const [
      completedTasksRaw,
      decisionsRaw,
      meetingsRaw,
      followUpsRaw,
      upcomingTasksRaw,
      highPriorityRemainingCount,
    ] = await Promise.all([
      // 1. Completed tasks in range
      prisma.task.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          updatedAt: { gte: start, lte: end },
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // 2. Decisions logged in range
      prisma.decision.findMany({
        where: {
          OR: [{ userId }, { meeting: { userId } }],
          decidedAt: { gte: start, lte: end },
        },
        include: {
          meeting: { select: { title: true } },
        },
        orderBy: { decidedAt: 'desc' },
      }),

      // 3. Meetings held in range
      prisma.meeting.findMany({
        where: {
          userId,
          startedAt: { gte: start, lte: end },
        },
        include: {
          decisions: true,
          actions: true,
        },
        orderBy: { startedAt: 'asc' },
      }),

      // 4. Active blockers and waiting follow-ups
      prisma.followUp.findMany({
        where: {
          userId,
          status: { in: ['OPEN', 'WAITING'] },
        },
        orderBy: { nextFollowUpAt: 'asc' },
        take: 15,
      }),

      // 5. Upcoming tasks due soon
      prisma.task.findMany({
        where: {
          userId,
          status: { in: ['INBOX', 'PLANNED', 'IN_PROGRESS', 'WAITING'] },
          dueAt: { gte: start, lte: nextWeekEnd },
        },
        orderBy: { dueAt: 'asc' },
        take: 15,
      }),

      // 6. High priority open count
      prisma.task.count({
        where: {
          userId,
          status: { in: ['INBOX', 'PLANNED', 'IN_PROGRESS', 'WAITING'] },
          priority: { in: ['HIGH', 'URGENT'] },
        },
      }),
    ]);

    // Format metrics
    const metrics: DigestMetrics = {
      tasksCompletedCount: completedTasksRaw.length,
      decisionsMadeCount: decisionsRaw.length,
      meetingsHeldCount: meetingsRaw.length,
      pendingFollowUpsCount: followUpsRaw.length,
      highPriorityTasksRemaining: highPriorityRemainingCount,
    };

    const completedTasks: DigestTaskItem[] = completedTasksRaw.map((t: any) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      assigneeName: t.assigneeName,
      completedAt: t.completedAt || t.updatedAt,
      dueAt: t.dueAt,
    }));

    const decisions: DigestDecisionItem[] = decisionsRaw.map((d: any) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      decidedAt: d.decidedAt,
      meetingTitle: d.meeting?.title,
    }));

    const meetings: DigestMeetingItem[] = meetingsRaw.map((m: any) => ({
      id: m.id,
      title: m.title,
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      location: m.location,
      decisionsCount: m.decisions.length,
      actionsCount: m.actions.length,
    }));

    const activeBlockersAndFollowUps: DigestFollowUpItem[] = followUpsRaw.map((f: any) => ({
      id: f.id,
      subject: f.subject,
      contactName: f.contactName,
      organization: f.organization,
      nextFollowUpAt: f.nextFollowUpAt,
      status: f.status,
    }));

    const upcomingTasks: DigestTaskItem[] = upcomingTasksRaw.map((t: any) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      assigneeName: t.assigneeName,
      dueAt: t.dueAt,
    }));

    const formattedRange = `${start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} – ${end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;

    // Generate Markdown Digest
    const markdown = this.buildMarkdownDigest({
      formattedRange,
      metrics,
      completedTasks,
      decisions,
      meetings,
      activeBlockersAndFollowUps,
      upcomingTasks,
    });

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        formattedRange,
      },
      metrics,
      completedTasks,
      decisions,
      meetings,
      activeBlockersAndFollowUps,
      upcomingTasks,
      markdown,
    };
  }

  private static buildMarkdownDigest(params: {
    formattedRange: string;
    metrics: DigestMetrics;
    completedTasks: DigestTaskItem[];
    decisions: DigestDecisionItem[];
    meetings: DigestMeetingItem[];
    activeBlockersAndFollowUps: DigestFollowUpItem[];
    upcomingTasks: DigestTaskItem[];
  }): string {
    const {
      formattedRange,
      metrics,
      completedTasks,
      decisions,
      meetings,
      activeBlockersAndFollowUps,
      upcomingTasks,
    } = params;

    let md = `# 📊 LeadDesk Leadership Weekly Digest\n`;
    md += `**Reporting Period:** ${formattedRange}\n\n`;

    // Executive Metrics Summary
    md += `### 📈 Executive Pulse\n`;
    md += `- **Closed Tasks:** ${metrics.tasksCompletedCount}\n`;
    md += `- **Decisions Logged:** ${metrics.decisionsMadeCount}\n`;
    md += `- **Meetings Held:** ${metrics.meetingsHeldCount}\n`;
    md += `- **Pending Follow-ups:** ${metrics.pendingFollowUpsCount}\n`;
    md += `- **Open High-Priority Items:** ${metrics.highPriorityTasksRemaining}\n\n`;

    // 1. Completed Tasks
    md += `### 🎯 Key Wins & Completed Deliverables (${completedTasks.length})\n`;
    if (completedTasks.length === 0) {
      md += `*No tasks marked completed during this period.*\n\n`;
    } else {
      completedTasks.forEach((t) => {
        const assignee = t.assigneeName ? ` *(Assigned to: ${t.assigneeName})*` : '';
        const priorityBadge = `\`[${t.priority}]\``;
        md += `- [x] ${priorityBadge} **${t.title}**${assignee}\n`;
      });
      md += `\n`;
    }

    // 2. Decisions
    md += `### 🛡️ Architectural & Leadership Decisions (${decisions.length})\n`;
    if (decisions.length === 0) {
      md += `*No architectural or strategic decisions recorded this week.*\n\n`;
    } else {
      decisions.forEach((d) => {
        const source = d.meetingTitle ? ` *(From: ${d.meetingTitle})*` : '';
        md += `- **${d.title}**${source}\n`;
        if (d.description) {
          md += `  > ${d.description.replace(/\n/g, ' ')}\n`;
        }
      });
      md += `\n`;
    }

    // 3. Meetings Held
    md += `### 📅 Key Meetings & Synchronizations (${meetings.length})\n`;
    if (meetings.length === 0) {
      md += `*No meetings held during this period.*\n\n`;
    } else {
      meetings.forEach((m) => {
        const dateStr = new Date(m.startedAt).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        const details = [
          m.location ? `Loc: ${m.location}` : null,
          `${m.actionsCount} action(s)`,
          `${m.decisionsCount} decision(s)`,
        ].filter(Boolean).join(' • ');
        md += `- **${m.title}** — *${dateStr}* (${details})\n`;
      });
      md += `\n`;
    }

    // 4. Blockers & Follow-ups
    md += `### ⚠️ Active Blockers & Waiting-For Items (${activeBlockersAndFollowUps.length})\n`;
    if (activeBlockersAndFollowUps.length === 0) {
      md += `*All stakeholder dependencies are resolved.*\n\n`;
    } else {
      activeBlockersAndFollowUps.forEach((f) => {
        const dateStr = new Date(f.nextFollowUpAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const org = f.organization ? ` (${f.organization})` : '';
        md += `- ⏳ **${f.subject}** with **${f.contactName}**${org} *(Due: ${dateStr})* [${f.status}]\n`;
      });
      md += `\n`;
    }

    // 5. Next Week's Outlook
    md += `### 🔮 Next Week's Priorities & Milestones (${upcomingTasks.length})\n`;
    if (upcomingTasks.length === 0) {
      md += `*No scheduled tasks for next week yet.*\n\n`;
    } else {
      upcomingTasks.forEach((t) => {
        const dueStr = t.dueAt
          ? ` *(Target: ${new Date(t.dueAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })})*`
          : '';
        const assignee = t.assigneeName ? ` — *${t.assigneeName}*` : '';
        md += `- [ ] \`[${t.priority}]\` **${t.title}**${dueStr}${assignee}\n`;
      });
      md += `\n`;
    }

    md += `---\n*Generated automatically with LeadDesk Engineering Leadership OS*\n`;

    return md;
  }
}
