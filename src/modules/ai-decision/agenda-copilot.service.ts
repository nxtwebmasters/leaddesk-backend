import { prisma } from '../../common/prisma';
import {
  Generate1on1AgendaInput,
  Update1on1AgendaInput,
  AgendaTalkingPoint,
} from './ai-decision.types';

export class AgendaCopilotService {
  /**
   * Synthesize tailored 1-on-1 meeting agenda by correlating member tasks, PR latencies, DevEx telemetry, and follow-ups.
   */
  public static async generateAgenda(
    orgId: string,
    leadId: string,
    input: Generate1on1AgendaInput
  ) {
    const member = await prisma.user.findUnique({
      where: { id: input.memberId },
      include: {
        tasks: {
          where: {
            status: { in: ['INBOX', 'PLANNED', 'IN_PROGRESS', 'WAITING'] },
          },
          orderBy: { dueAt: 'asc' },
          take: 20,
        },
        devexPulses: {
          where: { orgId },
          orderBy: { submittedAt: 'desc' },
          take: 3,
        },
        followUps: {
          where: { status: 'OPEN' },
          take: 5,
        },
      },
    });

    if (!member) throw new Error('Target team member not found');

    // Query PR watchdog for PRs associated with this member's email or name
    const [stalledPrs, activePrs] = await Promise.all([
      prisma.pullRequestWatch.findMany({
        where: {
          orgId,
          isStalled: true,
          status: 'OPEN',
          OR: [
            { authorUsername: { contains: member.displayName, mode: 'insensitive' } },
            { authorEmail: { contains: member.email, mode: 'insensitive' } },
          ],
        },
        take: 5,
      }),
      prisma.pullRequestWatch.findMany({
        where: {
          orgId,
          status: 'OPEN',
        },
        take: 10,
      }),
    ]);

    const now = new Date();
    const talkingPoints: AgendaTalkingPoint[] = [];

    // 1. PROJECT STATUS & DELIVERABLES
    const overdueTasks = member.tasks.filter((t) => t.dueAt && new Date(t.dueAt) < now);
    const urgentTasks = member.tasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH');

    if (overdueTasks.length > 0) {
      talkingPoints.push({
        title: `Overdue Deliverables Check-in (${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''})`,
        category: 'PROJECT_STATUS',
        reason: `${overdueTasks.map((t) => `"${t.title}"`).join(', ')} past original due date. Check if scope needs trimming or unblocking.`,
        sourceCitation: `Task Tracker: ${overdueTasks.length} overdue item(s)`,
        suggestedAction: 'Offer assistance or re-estimate deliverable timeline.',
      });
    }

    if (urgentTasks.length > 0) {
      talkingPoints.push({
        title: `Sprint Priority Focus: ${urgentTasks[0].title}`,
        category: 'PROJECT_STATUS',
        reason: `High priority item in ${urgentTasks[0].status} state. Confirm alignment on P0 acceptance criteria.`,
        sourceCitation: `Task ID: ${urgentTasks[0].id}`,
        suggestedAction: 'Clarify dependencies and definition of done.',
      });
    } else {
      talkingPoints.push({
        title: 'Current Sprint Workload & Task Flow',
        category: 'PROJECT_STATUS',
        reason: `Member is actively tracking ${member.tasks.length} open task(s). Velocity appears steady.`,
        sourceCitation: `Active Backlog: ${member.tasks.length} tasks`,
        suggestedAction: 'Review upcoming roadmap items and capacity for next sprint.',
      });
    }

    // 2. BLOCKERS & CODE REVIEW SLA
    if (stalledPrs.length > 0) {
      talkingPoints.push({
        title: `Unblock Stalled Pull Request #${stalledPrs[0].prNumber}`,
        category: 'BLOCKERS_AND_SLA',
        reason: `PR #${stalledPrs[0].prNumber} ("${stalledPrs[0].title}") has breached review SLA (>24h). Needs lead intervention to get peer reviews.`,
        sourceCitation: `GitHub Watchdog: ${stalledPrs[0].repository}#${stalledPrs[0].prNumber}`,
        suggestedAction: 'Designate senior peer reviewer or pair on review comments today.',
      });
    }

    // 3. WELLBEING & DEVEX BURNOUT PULSE
    const latestPulse = member.devexPulses[0];
    if (latestPulse) {
      const burden = latestPulse.onCallBurden ?? 1;
      if (latestPulse.score <= 3 || burden >= 3) {
        talkingPoints.push({
          title: 'Workload & On-Call Balance Check-in',
          category: 'WELLBEING_AND_DEVEX',
          reason: `Recent sentiment rating was ${latestPulse.score}/5 with on-call burden rated at ${burden}/5. Primary friction noted: ${latestPulse.frictionArea || 'General friction'}.`,
          sourceCitation: `DevEx Pulse (${new Date(latestPulse.submittedAt).toLocaleDateString()})`,
          suggestedAction: 'Discuss offloading on-call rotation duties or carving out meeting-free focus days.',
        });
      } else {
        talkingPoints.push({
          title: 'Sustaining Flow State & Deep Work Hours',
          category: 'WELLBEING_AND_DEVEX',
          reason: `Member reported healthy morale (${latestPulse.score}/5) with ${latestPulse.focusTimeHours || 20}h uninterrupted flow time.`,
          sourceCitation: `DevEx Pulse: Sentiment ${latestPulse.score}/5`,
          suggestedAction: 'Reinforce positive team momentum and protect flow hours.',
        });
      }
    } else {
      talkingPoints.push({
        title: 'Developer Experience & Engineering Happiness',
        category: 'WELLBEING_AND_DEVEX',
        reason: 'Open forum on cognitive load, tooling speed, and context switching.',
        sourceCitation: 'General DevEx Telemetry',
        suggestedAction: 'Ask: "What is the single most frustrating thing about our dev stack right now?"',
      });
    }

    // 4. CAREER & GROWTH
    talkingPoints.push({
      title: 'Growth & High-Impact Contributions Recognition',
      category: 'CAREER_AND_GROWTH',
      reason: 'Acknowledge recent technical achievements and discuss stretch opportunities for the upcoming quarter.',
      sourceCitation: 'Leadership Coaching Framework',
      suggestedAction: 'Discuss roadmap ownership or mentoring junior engineers.',
    });

    // Create & save agenda record
    const agenda = await prisma.oneOnOneAgenda.create({
      data: {
        orgId,
        leadId,
        memberId: input.memberId,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        status: 'DRAFT',
        talkingPoints: talkingPoints as any,
        actionItems: [],
        notes: null,
      },
      include: {
        member: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    return agenda;
  }

  /**
   * List 1-on-1 agendas for a lead
   */
  public static async listAgendas(orgId: string, leadId: string) {
    return prisma.oneOnOneAgenda.findMany({
      where: { orgId, leadId },
      include: {
        member: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Update agenda notes or action items
   */
  public static async updateAgenda(agendaId: string, input: Update1on1AgendaInput) {
    return prisma.oneOnOneAgenda.update({
      where: { id: agendaId },
      data: {
        status: input.status,
        actionItems: input.actionItems as any,
        notes: input.notes,
      },
    });
  }
}
