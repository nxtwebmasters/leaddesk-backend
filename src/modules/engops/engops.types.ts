import { z } from 'zod';

export type DoraTier = 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface DoraMetricResult {
  tier: DoraTier;
  value: number;
  formattedValue: string;
  description: string;
  target: string;
}

export interface DoraScorecard {
  overallTier: DoraTier;
  timeframeDays: number;
  deploymentFrequency: DoraMetricResult & { deploysPerDay: number; totalDeployments: number };
  leadTimeForChanges: DoraMetricResult & { medianHours: number };
  changeFailureRate: DoraMetricResult & { ratePercent: number; failedDeployments: number };
  timeToRestoreService: DoraMetricResult & { medianHours: number; totalIncidents: number };
}

export interface DevExRadarMetrics {
  averageScore: number;
  totalSubmissions: number;
  burnoutRisk: 'LOW' | 'MODERATE' | 'HIGH';
  averageFocusTimeHours: number;
  averageOnCallBurden: number;
  frictionBreakdown: Record<string, number>;
  topFrictionArea: string;
}

export const recordDeploymentSchema = z.object({
  serviceName: z.string().trim().min(2),
  version: z.string().trim().min(1),
  environment: z.enum(['PRODUCTION', 'STAGING', 'CANARY']).default('PRODUCTION'),
  status: z.enum(['SUCCESS', 'FAILED', 'ROLLED_BACK']).default('SUCCESS'),
  commitSha: z.string().trim().optional().nullable(),
  commitMessage: z.string().trim().optional().nullable(),
  leadTimeMinutes: z.number().int().min(0).optional().nullable(),
  deployedBy: z.string().trim().optional().nullable(),
  workspaceId: z.string().uuid().optional().nullable(),
});

export type RecordDeploymentInput = z.infer<typeof recordDeploymentSchema>;

export const recordIncidentSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional().nullable(),
  severity: z.enum(['SEV1_CRITICAL', 'SEV2_HIGH', 'SEV3_MEDIUM', 'SEV4_LOW']).default('SEV2_HIGH'),
  status: z.enum(['INVESTIGATING', 'IDENTIFIED', 'MITIGATED', 'RESOLVED']).default('RESOLVED'),
  serviceName: z.string().trim().min(2),
  startedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional().nullable(),
  rootCause: z.string().trim().optional().nullable(),
  deploymentId: z.string().uuid().optional().nullable(),
  isChangeFailure: z.boolean().default(true),
});

export type RecordIncidentInput = z.infer<typeof recordIncidentSchema>;

export const submitPulseSchema = z.object({
  score: z.number().int().min(1).max(5),
  frictionArea: z.enum(['CODE_REVIEW', 'CI_CD_BUILD', 'ON_CALL', 'REQUIREMENTS', 'MEETINGS', 'NONE']).default('NONE'),
  focusTimeHours: z.number().min(0).max(80).optional(),
  onCallBurden: z.number().int().min(1).max(5).default(1),
  notes: z.string().trim().optional(),
  isAnonymous: z.boolean().default(true),
  teamId: z.string().uuid().optional().nullable(),
});

export type SubmitPulseInput = z.infer<typeof submitPulseSchema>;

export const createObjectiveSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional().nullable(),
  level: z.enum(['ORGANIZATION', 'WORKSPACE', 'TEAM']).default('WORKSPACE'),
  quarter: z.string().trim().default('2026-Q4'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  workspaceId: z.string().uuid().optional().nullable(),
});

export type CreateObjectiveInput = z.infer<typeof createObjectiveSchema>;

export const createKeyResultSchema = z.object({
  title: z.string().trim().min(3),
  targetValue: z.number().min(0.01),
  currentValue: z.number().default(0),
  initialValue: z.number().default(0),
  unit: z.string().trim().default('%'),
  ownerName: z.string().trim().optional().nullable(),
});

export type CreateKeyResultInput = z.infer<typeof createKeyResultSchema>;

export const updateKeyResultSchema = z.object({
  title: z.string().trim().min(3).optional(),
  currentValue: z.number().optional(),
  status: z.enum(['ON_TRACK', 'AT_RISK', 'BEHIND', 'COMPLETED', 'CANCELLED']).optional(),
  ownerName: z.string().trim().optional().nullable(),
});

export type UpdateKeyResultInput = z.infer<typeof updateKeyResultSchema>;
