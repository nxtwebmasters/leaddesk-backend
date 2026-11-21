import { Request, Response } from 'express';
import { AuditService } from './audit.service';
import { RetentionService } from './retention.service';
import { ComplianceService } from './compliance.service';
import {
  listAuditLogsQuerySchema,
  upsertRetentionPolicySchema,
  toggleLegalHoldSchema,
  requestExportSchema,
  gdprForgetSchema,
} from './compliance.types';
import { sendSuccess, sendError } from '../../common/response';

export class ComplianceController {
  /**
   * List Audit Logs
   */
  public static async listAuditLogs(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const parsed = listAuditLogsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid query', 400);
      }

      const result = await AuditService.listLogs(orgId, parsed.data);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to list audit logs', 500);
    }
  }

  /**
   * Verify Merkle chain cryptographic integrity
   */
  public static async verifyMerkleIntegrity(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const result = await AuditService.verifyIntegrity(orgId);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to verify Merkle chain integrity', 500);
    }
  }

  /**
   * List Retention Policies
   */
  public static async listRetentionPolicies(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const policies = await RetentionService.listPolicies(orgId);
      return sendSuccess(res, { policies });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to list retention policies', 500);
    }
  }

  /**
   * Upsert Retention Policy
   */
  public static async upsertRetentionPolicy(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const userId = (req as any).user?.userId;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const parsed = upsertRetentionPolicySchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid policy input', 400);
      }

      const policy = await RetentionService.upsertPolicy(orgId, parsed.data, userId);
      return sendSuccess(res, policy);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to update retention policy', 400);
    }
  }

  /**
   * Toggle Legal Hold
   */
  public static async toggleLegalHold(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const userId = (req as any).user?.userId;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const parsed = toggleLegalHoldSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const updated = await RetentionService.toggleLegalHold(orgId, parsed.data, userId);
      return sendSuccess(res, updated);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to toggle legal hold', 400);
    }
  }

  /**
   * Run Retention Purge Now
   */
  public static async runPurge(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const userId = (req as any).user?.userId;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const results = await RetentionService.runPurge(orgId, userId);
      return sendSuccess(res, { results });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to run retention purge', 500);
    }
  }

  /**
   * Request Compliance Export (GDPR Takeout or Legal Discovery)
   */
  public static async requestExport(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const userId = (req as any).user?.userId;
      if (!orgId || !userId) return sendError(res, 'BAD_REQUEST', 'Missing context', 400);

      const parsed = requestExportSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid export request', 400);
      }

      const exportResult = await ComplianceService.requestExport(orgId, userId, parsed.data);
      return sendSuccess(res, exportResult, undefined, 201);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to create compliance export', 400);
    }
  }

  /**
   * List Compliance Exports
   */
  public static async listExports(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const exportsList = await ComplianceService.listExports(orgId);
      return sendSuccess(res, { exports: exportsList });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to list exports', 500);
    }
  }

  /**
   * Execute GDPR Article 17 Right-to-be-Forgotten
   */
  public static async executeGdprForget(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const userId = (req as any).user?.userId;
      if (!orgId || !userId) return sendError(res, 'BAD_REQUEST', 'Missing context', 400);

      const parsed = gdprForgetSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid erasure input', 400);
      }

      const result = await ComplianceService.executeGdprForget(orgId, userId, parsed.data);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to execute GDPR erasure', 400);
    }
  }
}
