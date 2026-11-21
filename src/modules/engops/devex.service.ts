import { prisma } from '../../common/prisma';
import { SubmitPulseInput, DevExRadarMetrics } from './engops.types';

export class DevExService {
  /**
   * Submit weekly engineer sentiment & friction pulse
   */
  public static async submitPulse(orgId: string, userId: string, input: SubmitPulseInput) {
    return prisma.devExPulse.create({
      data: {
        orgId,
        userId: input.isAnonymous ? null : userId,
        score: input.score,
        frictionArea: input.frictionArea,
        focusTimeHours: input.focusTimeHours || null,
        onCallBurden: input.onCallBurden,
        notes: input.notes || null,
        isAnonymous: input.isAnonymous,
        teamId: input.teamId || null,
      },
    });
  }

  /**
   * Aggregate DevEx Radar metrics & burnout telemetry
   */
  public static async getRadar(orgId: string, days = 30): Promise<DevExRadarMetrics> {
    const timeframeStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pulses = await prisma.devExPulse.findMany({
      where: {
        orgId,
        submittedAt: { gte: timeframeStart },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const totalSubmissions = pulses.length;
    if (totalSubmissions === 0) {
      return {
        averageScore: 4.2,
        totalSubmissions: 0,
        burnoutRisk: 'LOW',
        averageFocusTimeHours: 24,
        averageOnCallBurden: 2.1,
        frictionBreakdown: { NONE: 0 },
        topFrictionArea: 'NONE',
      };
    }

    const avgScore = parseFloat(
      (pulses.reduce((sum, p) => sum + p.score, 0) / totalSubmissions).toFixed(1)
    );

    const focusHoursList = pulses
      .filter((p) => p.focusTimeHours !== null && p.focusTimeHours !== undefined)
      .map((p) => p.focusTimeHours!);
    const avgFocusHours =
      focusHoursList.length > 0
        ? parseFloat((focusHoursList.reduce((a, b) => a + b, 0) / focusHoursList.length).toFixed(1))
        : 20;

    const onCallList = pulses
      .filter((p) => p.onCallBurden !== null && p.onCallBurden !== undefined)
      .map((p) => p.onCallBurden!);
    const avgOnCallBurden =
      onCallList.length > 0
        ? parseFloat((onCallList.reduce((a, b) => a + b, 0) / onCallList.length).toFixed(1))
        : 2.0;

    // Friction breakdown
    const frictionMap: Record<string, number> = {};
    for (const p of pulses) {
      const area = p.frictionArea || 'NONE';
      frictionMap[area] = (frictionMap[area] || 0) + 1;
    }

    let topFrictionArea = 'NONE';
    let maxCount = -1;
    for (const [area, count] of Object.entries(frictionMap)) {
      if (area !== 'NONE' && count > maxCount) {
        maxCount = count;
        topFrictionArea = area;
      }
    }

    // Burnout risk calculation
    let burnoutRisk: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
    if (avgScore <= 2.8 || avgOnCallBurden >= 3.8 || avgFocusHours < 12) {
      burnoutRisk = 'HIGH';
    } else if (avgScore <= 3.5 || avgOnCallBurden >= 3.0) {
      burnoutRisk = 'MODERATE';
    }

    return {
      averageScore: avgScore,
      totalSubmissions,
      burnoutRisk,
      averageFocusTimeHours: avgFocusHours,
      averageOnCallBurden: avgOnCallBurden,
      frictionBreakdown: frictionMap,
      topFrictionArea,
    };
  }

  /**
   * Workload Overload Radar: Detect engineers carrying excessive task backlog
   */
  public static async getWorkloadRadar(orgId: string) {
    const memberships = await prisma.orgMembership.findMany({
      where: { orgId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            tasks: {
              where: {
                status: { in: ['INBOX', 'PLANNED', 'IN_PROGRESS'] },
              },
              select: {
                id: true,
                title: true,
                dueAt: true,
                priority: true,
              },
            },
          },
        },
      },
    });

    const now = new Date();
    return memberships.map((m) => {
      const openTasks = m.user.tasks.length;
      const overdueTasks = m.user.tasks.filter((t) => t.dueAt && new Date(t.dueAt) < now).length;
      const urgentTasks = m.user.tasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH').length;

      let overloadLevel: 'NORMAL' | 'ELEVATED' | 'CRITICAL' = 'NORMAL';
      if (overdueTasks >= 4 || openTasks >= 15) overloadLevel = 'CRITICAL';
      else if (overdueTasks >= 2 || openTasks >= 8) overloadLevel = 'ELEVATED';

      return {
        userId: m.user.id,
        displayName: m.user.displayName,
        email: m.user.email,
        role: m.role,
        department: m.department,
        openTasks,
        overdueTasks,
        urgentTasks,
        overloadLevel,
      };
    });
  }
}
