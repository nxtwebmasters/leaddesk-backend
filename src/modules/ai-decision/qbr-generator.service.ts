import { prisma } from '../../common/prisma';
import { DoraService } from '../engops/dora.service';
import { OkrService } from '../engops/okr.service';
import { DevExService } from '../engops/devex.service';
import { GenerateQbrInput } from './ai-decision.types';

export class QbrGeneratorService {
  /**
   * Synthesize real-time operational data into a high-impact Quarterly Business Review (QBR) & Engineering Retrospective.
   */
  public static async generate(
    orgId: string,
    userId: string,
    input: GenerateQbrInput
  ) {
    const quarter = input.quarter || '2026-Q4';
    const title = input.title || `Engineering Executive Retrospective & QBR (${quarter})`;

    // 1. Gather 90-day DORA Metrics
    const dora = await DoraService.getDoraScorecard(orgId, 90);

    // 2. Gather Quarterly Objectives & OKRs
    const okrs = await OkrService.listObjectives(orgId, quarter);

    // 3. Gather Incident & Reliability History
    const incidents = await prisma.incident.findMany({
      where: { orgId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    // 4. Gather DevEx & Burnout Telemetry
    const devex = await DevExService.getRadar(orgId, 90);

    // Synthesize Sections
    const completedOkrs = okrs.filter((o) => o.status === 'COMPLETED' || o.progressPercent >= 100);
    const avgOkrProgress =
      okrs.length > 0
        ? parseFloat((okrs.reduce((sum, o) => sum + o.progressPercent, 0) / okrs.length).toFixed(1))
        : 0;

    const criticalIncidents = incidents.filter((i) => i.severity === 'SEV1_CRITICAL' || i.severity === 'SEV2_HIGH');

    // Strategic Priorities Formulation
    const strategicPriorities = [
      dora.overallTier === 'ELITE'
        ? 'Scale automated canary deployments to maintain Elite DORA tier'
        : 'Optimize CI/CD build pipelines and testing queues to reach Elite deployment frequency',
      criticalIncidents.length > 0
        ? `Enhance observability and synthetic alerts to reduce P99 MTTR from ${dora.timeToRestoreService.formattedValue}`
        : 'Maintain zero high-severity production regressions through automated contract tests',
      devex.burnoutRisk === 'HIGH'
        ? 'Implement team-wide No-Meeting Focus Wednesdays to address developer burnout alert'
        : 'Continue protecting deep work flow hours to sustain high engineering morale',
      'Cascade upcoming quarter OKRs with designated team tech leads across all engineering squads',
    ];

    // Build Executive Markdown Summary
    let executiveSummary = `# ${title}\n\n`;
    executiveSummary += `## Executive Summary & Scorecard\n`;
    executiveSummary += `During **${quarter}**, engineering velocity and operational stability achieved an overall **DORA ${dora.overallTier} Performance Tier**. `;
    executiveSummary += `The engineering organization delivered **${completedOkrs.length} of ${okrs.length}** planned strategic OKRs (${avgOkrProgress}% average completion rate) while sustaining an average developer sentiment score of **${devex.averageScore}/5.0**.\n\n`;

    executiveSummary += `### 1. DORA 4 Throughput & Reliability Pillars (90-Day Rolling Window)\n`;
    executiveSummary += `| DORA Metric | Performance | Google DORA Tier | Benchmark Target |\n`;
    executiveSummary += `| :--- | :--- | :--- | :--- |\n`;
    executiveSummary += `| **Deployment Frequency** | ${dora.deploymentFrequency.formattedValue} | \`${dora.deploymentFrequency.tier}\` | ${dora.deploymentFrequency.target} |\n`;
    executiveSummary += `| **Lead Time for Changes** | ${dora.leadTimeForChanges.formattedValue} | \`${dora.leadTimeForChanges.tier}\` | ${dora.leadTimeForChanges.target} |\n`;
    executiveSummary += `| **Change Failure Rate** | ${dora.changeFailureRate.formattedValue} | \`${dora.changeFailureRate.tier}\` | ${dora.changeFailureRate.target} |\n`;
    executiveSummary += `| **Time to Restore (MTTR)** | ${dora.timeToRestoreService.formattedValue} | \`${dora.timeToRestoreService.tier}\` | ${dora.timeToRestoreService.target} |\n\n`;

    executiveSummary += `### 2. Quarterly OKRs & Strategic Delivery\n`;
    if (okrs.length > 0) {
      okrs.forEach((obj) => {
        executiveSummary += `* **[${obj.level} OKR] ${obj.title}** (${obj.progressPercent}% - \`${obj.status}\`)\n`;
        obj.keyResults.forEach((kr) => {
          executiveSummary += `  - ${kr.title}: **${kr.currentValue}/${kr.targetValue} ${kr.unit}** (${kr.progressPercent}%)\n`;
        });
      });
    } else {
      executiveSummary += `*No formal OKRs were recorded for this quarter.*\n`;
    }

    executiveSummary += `\n### 3. Production Stability & Incident Retrospective\n`;
    executiveSummary += `* **Total Outages Logged:** ${incidents.length} (${criticalIncidents.length} critical SEV-1/SEV-2).\n`;
    executiveSummary += `* **Median Restoration Latency:** ${dora.timeToRestoreService.formattedValue}.\n`;
    if (incidents.length > 0) {
      executiveSummary += `* **Key Incident Lessons:** ${incidents.slice(0, 3).map((i) => `"${i.title}" (${i.rootCause || 'Under investigation'})`).join('; ')}.\n`;
    }

    executiveSummary += `\n### 4. Developer Experience & Team Health Radar\n`;
    executiveSummary += `* **Overall Morale Score:** ${devex.averageScore}/5.0 based on ${devex.totalSubmissions} weekly pulses.\n`;
    executiveSummary += `* **Uninterrupted Flow Time:** ${devex.averageFocusTimeHours} hours/week average.\n`;
    executiveSummary += `* **Burnout Risk Level:** \`${devex.burnoutRisk}\`.\n`;
    executiveSummary += `* **Top Friction Bottleneck Identified:** \`${devex.topFrictionArea}\`.\n\n`;

    executiveSummary += `### 5. Strategic Focus Priorities for Next Quarter\n`;
    strategicPriorities.forEach((p, idx) => {
      executiveSummary += `${idx + 1}. ${p}\n`;
    });

    const review = await prisma.quarterlyReview.upsert({
      where: {
        orgId_quarter: {
          orgId,
          quarter,
        },
      },
      update: {
        title,
        executiveSummary,
        doraSummary: dora as any,
        okrSummary: { okrs, completedCount: completedOkrs.length, avgProgress: avgOkrProgress } as any,
        reliabilitySummary: { totalIncidents: incidents.length, criticalCount: criticalIncidents.length, mttrHours: dora.timeToRestoreService.medianHours } as any,
        devexSummary: devex as any,
        strategicPriorities: strategicPriorities as any,
        generatedById: userId,
      },
      create: {
        orgId,
        quarter,
        title,
        executiveSummary,
        doraSummary: dora as any,
        okrSummary: { okrs, completedCount: completedOkrs.length, avgProgress: avgOkrProgress } as any,
        reliabilitySummary: { totalIncidents: incidents.length, criticalCount: criticalIncidents.length, mttrHours: dora.timeToRestoreService.medianHours } as any,
        devexSummary: devex as any,
        strategicPriorities: strategicPriorities as any,
        generatedById: userId,
      },
    });

    return review;
  }

  /**
   * List all generated quarterly reviews for an organization
   */
  public static async list(orgId: string) {
    return prisma.quarterlyReview.findMany({
      where: { orgId },
      orderBy: { quarter: 'desc' },
      take: 20,
    });
  }

  /**
   * Get review by quarter
   */
  public static async getByQuarter(orgId: string, quarter: string) {
    return prisma.quarterlyReview.findUnique({
      where: {
        orgId_quarter: { orgId, quarter },
      },
    });
  }
}
