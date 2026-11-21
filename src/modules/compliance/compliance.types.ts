import { z } from 'zod';

export interface MerkleVerificationResult {
  isValid: boolean;
  checkedRecords: number;
  breachedRecordId?: string;
  error?: string;
}

export interface PurgeResult {
  entityType: string;
  purgedCount: number;
  retentionDays: number;
  cutoffDate: Date;
}

export const listAuditLogsQuerySchema = z.object({
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export const upsertRetentionPolicySchema = z.object({
  entityType: z.enum([
    'AUDIT_LOGS',
    'INTEGRATION_EVENTS',
    'INBOX_ITEMS',
    'TASKS',
    'MEETINGS',
  ]),
  retentionDays: z.number().int().min(7).max(3650), // 7 days to 10 years
  action: z.enum(['DELETE', 'ANONYMIZE', 'ARCHIVE']).default('DELETE'),
  isActive: z.boolean().default(true),
  legalHold: z.boolean().default(false),
});

export type UpsertRetentionPolicyInput = z.infer<typeof upsertRetentionPolicySchema>;

export const toggleLegalHoldSchema = z.object({
  entityType: z.string().trim().min(2),
  legalHold: z.boolean(),
  reason: z.string().trim().optional(),
});

export type ToggleLegalHoldInput = z.infer<typeof toggleLegalHoldSchema>;

export const requestExportSchema = z.object({
  type: z.enum(['GDPR_TAKEOUT', 'LEGAL_DISCOVERY', 'AUDIT_REPORT']),
  targetUserId: z.string().uuid().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export type RequestExportInput = z.infer<typeof requestExportSchema>;

export const gdprForgetSchema = z.object({
  targetUserId: z.string().uuid(),
  confirmEmail: z.string().email(),
  reason: z.string().trim().default('GDPR Right-to-be-Forgotten request'),
});

export type GdprForgetInput = z.infer<typeof gdprForgetSchema>;
