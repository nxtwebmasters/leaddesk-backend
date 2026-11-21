import { prisma } from '../../common/prisma';
import {
  DoraScorecard,
  DoraTier,
  RecordDeploymentInput,
  RecordIncidentInput,
} from './engops.types';

export class DoraService {
  /**
   * Helper to calculate median value from a numeric array
   */
  private static calculateMedian(values: number[]): number {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate DORA 4 Metrics Scorecard for the organization
   */
  public static async getDoraScorecard(orgId: string, days = 30): Promise<DoraScorecard> {
    const timeframeStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [deployments, incidents] = await Promise.all([
      prisma.deployment.findMany({
        where: {
          orgId,
          environment: 'PRODUCTION',
          deployedAt: { gte: timeframeStart },
        },
        orderBy: { deployedAt: 'desc' },
      }),
      prisma.incident.findMany({
        where: {
          orgId,
          startedAt: { gte: timeframeStart },
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const totalDeployments = deployments.length;
    const successfulDeploys = deployments.filter((d) => d.status === 'SUCCESS').length;
    const failedDeploys = deployments.filter((d) => d.status === 'FAILED' || d.status === 'ROLLED_BACK').length;

    // 1. DEPLOYMENT FREQUENCY (DF)
    const deploysPerDay = parseFloat((successfulDeploys / Math.max(1, days)).toFixed(2));
    let dfTier: DoraTier = 'LOW';
    let dfDesc = 'Fewer than once per month';

    if (deploysPerDay >= 1.0) {
      dfTier = 'ELITE';
      dfDesc = 'On-demand (multiple deploys per day)';
    } else if (deploysPerDay >= 1 / 7) {
      dfTier = 'HIGH';
      dfDesc = 'Between once per day and once per week';
    } else if (deploysPerDay >= 1 / 30) {
      dfTier = 'MEDIUM';
      dfDesc = 'Between once per week and once per month';
    }

    // 2. LEAD TIME FOR CHANGES (LTTC)
    const leadTimes = deployments
      .filter((d) => d.leadTimeMinutes !== null && d.leadTimeMinutes !== undefined)
      .map((d) => d.leadTimeMinutes!);

    const medianLeadMinutes = this.calculateMedian(leadTimes);
    const medianLeadHours = parseFloat((medianLeadMinutes / 60).toFixed(1));
    let lttcTier: DoraTier = 'LOW';
    let lttcDesc = 'More than six months';

    if (leadTimes.length === 0) {
      lttcTier = 'HIGH';
      lttcDesc = 'Under 24 hours';
    } else if (medianLeadHours <= 1.0) {
      lttcTier = 'ELITE';
      lttcDesc = 'Less than one hour';
    } else if (medianLeadHours <= 24.0) {
      lttcTier = 'HIGH';
      lttcDesc = 'Between one day and one week';
    } else if (medianLeadHours <= 168.0) {
      lttcTier = 'MEDIUM';
      lttcDesc = 'Between one week and one month';
    }

    // 3. CHANGE FAILURE RATE (CFR)
    // De-duplicate if incident is already linked to a failed deployment
    const failedDeploymentIds = new Set(
      deployments.filter((d) => d.status === 'FAILED' || d.status === 'ROLLED_BACK').map((d) => d.id)
    );
    const unlinkedOrSuccessfulChangeIncidents = incidents.filter(
      (i) => i.isChangeFailure && (!i.deploymentId || !failedDeploymentIds.has(i.deploymentId))
    ).length;
    const changeFailures = failedDeploymentIds.size + unlinkedOrSuccessfulChangeIncidents;
    const denominator = Math.max(1, totalDeployments);
    const cfrPercent = parseFloat(((changeFailures / denominator) * 100).toFixed(1));
    let cfrTier: DoraTier = 'LOW';
    let cfrDesc = '> 15% failure rate';

    if (cfrPercent <= 5.0) {
      cfrTier = 'ELITE';
      cfrDesc = '0% - 5%';
    } else if (cfrPercent <= 10.0) {
      cfrTier = 'HIGH';
      cfrDesc = '5% - 10%';
    } else if (cfrPercent <= 15.0) {
      cfrTier = 'MEDIUM';
      cfrDesc = '10% - 15%';
    }

    // 4. TIME TO RESTORE SERVICE (MTTR)
    const recoveryTimes = incidents
      .filter((i) => i.recoveryTimeMinutes !== null && i.recoveryTimeMinutes !== undefined)
      .map((i) => i.recoveryTimeMinutes!);

    const medianRecoveryMinutes = this.calculateMedian(recoveryTimes);
    const medianRecoveryHours = parseFloat((medianRecoveryMinutes / 60).toFixed(1));
    let mttrTier: DoraTier = 'LOW';
    let mttrDesc = 'More than one week';

    if (recoveryTimes.length === 0) {
      mttrTier = 'ELITE';
      mttrDesc = 'Zero production outages';
    } else if (medianRecoveryHours <= 1.0) {
      mttrTier = 'ELITE';
      mttrDesc = 'Less than one hour';
    } else if (medianRecoveryHours <= 24.0) {
      mttrTier = 'HIGH';
      mttrDesc = 'Less than one day';
    } else if (medianRecoveryHours <= 168.0) {
      mttrTier = 'MEDIUM';
      mttrDesc = 'Less than one week';
    }

    // Overall Tier Aggregation
    const tierPoints: Record<DoraTier, number> = { ELITE: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const avgScore =
      (tierPoints[dfTier] + tierPoints[lttcTier] + tierPoints[cfrTier] + tierPoints[mttrTier]) / 4;

    let overallTier: DoraTier = 'MEDIUM';
    if (avgScore >= 3.5) overallTier = 'ELITE';
    else if (avgScore >= 2.5) overallTier = 'HIGH';
    else if (avgScore < 1.75) overallTier = 'LOW';

    return {
      overallTier,
      timeframeDays: days,
      deploymentFrequency: {
        tier: dfTier,
        value: deploysPerDay,
        formattedValue: `${deploysPerDay}/day (${successfulDeploys} deploys)`,
        deploysPerDay,
        totalDeployments,
        description: dfDesc,
        target: '≥ 1.0 / day (Elite)',
      },
      leadTimeForChanges: {
        tier: lttcTier,
        value: medianLeadHours,
        formattedValue: `${medianLeadHours} hours`,
        medianHours: medianLeadHours,
        description: lttcDesc,
        target: '< 1 hour (Elite)',
      },
      changeFailureRate: {
        tier: cfrTier,
        value: cfrPercent,
        formattedValue: `${cfrPercent}%`,
        ratePercent: cfrPercent,
        failedDeployments: changeFailures,
        description: cfrDesc,
        target: '< 5% (Elite)',
      },
      timeToRestoreService: {
        tier: mttrTier,
        value: medianRecoveryHours,
        formattedValue: recoveryTimes.length === 0 ? 'Zero Outages' : `${medianRecoveryHours} hours`,
        medianHours: medianRecoveryHours,
        totalIncidents: incidents.length,
        description: mttrDesc,
        target: '< 1 hour (Elite)',
      },
    };
  }

  /**
   * Record new CI/CD deployment event
   */
  public static async recordDeployment(orgId: string, input: RecordDeploymentInput) {
    return prisma.deployment.create({
      data: {
        orgId,
        serviceName: input.serviceName,
        version: input.version || (input.commitSha ? input.commitSha.substring(0, 7) : 'v1.0.0'),
        environment: input.environment,
        status: input.status,
        commitSha: input.commitSha || null,
        commitMessage: input.commitMessage || null,
        leadTimeMinutes: input.leadTimeMinutes || null,
        deployedBy: input.deployedBy || 'CI/CD Pipeline',
        workspaceId: input.workspaceId || null,
      },
    });
  }

  /**
   * List recent deployments
   */
  public static async listDeployments(orgId: string, limit = 50) {
    return prisma.deployment.findMany({
      where: { orgId },
      orderBy: { deployedAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  /**
   * Record or resolve production incident
   */
  public static async recordIncident(orgId: string, input: RecordIncidentInput) {
    const startedAt = new Date(input.startedAt);
    const resolvedAt = input.resolvedAt ? new Date(input.resolvedAt) : null;

    let recoveryTimeMinutes: number | null = null;
    if (resolvedAt) {
      recoveryTimeMinutes = Math.max(0, Math.round((resolvedAt.getTime() - startedAt.getTime()) / (1000 * 60)));
    }

    return prisma.incident.create({
      data: {
        orgId,
        title: input.title,
        description: input.description || null,
        severity: input.severity,
        status: input.status,
        serviceName: input.serviceName,
        startedAt,
        resolvedAt,
        recoveryTimeMinutes,
        rootCause: input.rootCause || null,
        deploymentId: input.deploymentId || null,
        isChangeFailure: input.isChangeFailure,
      },
    });
  }

  /**
   * List recent incidents
   */
  public static async listIncidents(orgId: string, limit = 50) {
    return prisma.incident.findMany({
      where: { orgId },
      include: {
        deployment: {
          select: { version: true, serviceName: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }
}
