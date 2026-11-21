import { z } from 'zod';

export const INTEGRATION_PROVIDERS = [
  'GITHUB',
  'GITLAB',
  'JIRA',
  'LINEAR',
  'SLACK',
  'TEAMS',
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const PR_STATUSES = ['OPEN', 'MERGED', 'CLOSED', 'DRAFT'] as const;
export type PrStatus = (typeof PR_STATUSES)[number];

export const createIntegrationSchema = z.object({
  provider: z.enum(INTEGRATION_PROVIDERS),
  name: z.string().trim().min(2, 'Integration name must be at least 2 characters'),
  webhookSecret: z.string().trim().optional().nullable(),
  apiKey: z.string().trim().optional().nullable(),
  externalOrg: z.string().trim().optional().nullable(),
  workspaceId: z.string().uuid().optional().nullable(),
  config: z
    .object({
      prSlaHours: z.number().int().min(1).max(168).default(24),
      channelId: z.string().optional(),
      channelName: z.string().optional(),
      baseApiUrl: z.string().url().optional(),
      autoFollowUpOnStall: z.boolean().default(true),
    })
    .optional(),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;

export const updateIntegrationSchema = z.object({
  name: z.string().trim().min(2).optional(),
  isEnabled: z.boolean().optional(),
  webhookSecret: z.string().trim().optional().nullable(),
  apiKey: z.string().trim().optional().nullable(),
  externalOrg: z.string().trim().optional().nullable(),
  workspaceId: z.string().uuid().optional().nullable(),
  config: z
    .object({
      prSlaHours: z.number().int().min(1).max(168).optional(),
      channelId: z.string().optional(),
      channelName: z.string().optional(),
      baseApiUrl: z.string().url().optional(),
      autoFollowUpOnStall: z.boolean().optional(),
    })
    .optional(),
});

export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;

export interface PrWatchdogStats {
  totalTracked: number;
  openCount: number;
  stalledCount: number;
  mergedCount: number;
  avgReviewLatencyMinutes: number;
  slaBreachRatePercent: number;
  repositories: Array<{
    repository: string;
    openPrs: number;
    stalledPrs: number;
    avgLatencyMinutes: number;
  }>;
}
