import crypto from 'crypto';
import { prisma } from '../../common/prisma';
import { AuditService } from './audit.service';
import { RequestExportInput, GdprForgetInput } from './compliance.types';

export class ComplianceService {
  /**
   * Request a GDPR data portability takeout or Legal e-Discovery bundle
   */
  public static async requestExport(
    orgId: string,
    requestedById: string,
    input: RequestExportInput
  ) {
    let recordCount = 0;
    let exportData: any = {};

    if (input.type === 'GDPR_TAKEOUT') {
      const targetUserId = input.targetUserId || requestedById;
      const [user, tasks, notes, followups, pulses] = await Promise.all([
        prisma.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, email: true, displayName: true, timezone: true, createdAt: true },
        }),
        prisma.task.findMany({
          where: { userId: targetUserId },
          select: { id: true, title: true, description: true, status: true, priority: true, createdAt: true },
        }),
        prisma.note.findMany({
          where: { userId: targetUserId },
          select: { id: true, title: true, content: true, createdAt: true },
        }),
        prisma.followUp.findMany({
          where: { userId: targetUserId },
          select: { id: true, subject: true, contactName: true, status: true, createdAt: true },
        }),
        prisma.devExPulse.findMany({
          where: { userId: targetUserId },
          select: { id: true, score: true, frictionArea: true, focusTimeHours: true, submittedAt: true },
        }),
      ]);

      exportData = {
        meta: {
          exportType: 'GDPR_ARTICLE_20_DATA_PORTABILITY',
          generatedAt: new Date().toISOString(),
          requestedBy: requestedById,
        },
        profile: user,
        tasks,
        notes,
        followups,
        pulses,
      };
      recordCount = 1 + tasks.length + notes.length + followups.length + pulses.length;
    } else if (input.type === 'AUDIT_REPORT' || input.type === 'LEGAL_DISCOVERY') {
      const where: any = { orgId };
      if (input.startDate) where.createdAt = { gte: new Date(input.startDate) };
      if (input.endDate) {
        where.createdAt = where.createdAt || {};
        where.createdAt.lte = new Date(input.endDate);
      }

      const [auditLogs, decisions, policies] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        prisma.decision.findMany({
          where: {
            meeting: {
              user: {
                orgMemberships: { some: { orgId } },
              },
            },
          },
          take: 100,
        }),
        prisma.retentionPolicy.findMany({ where: { orgId } }),
      ]);

      exportData = {
        meta: {
          exportType: input.type,
          orgId,
          generatedAt: new Date().toISOString(),
          requestedBy: requestedById,
        },
        auditLogs,
        decisions,
        retentionPolicies: policies,
      };
      recordCount = auditLogs.length + decisions.length + policies.length;
    }

    const jsonString = JSON.stringify(exportData, null, 2);
    const fileSizeBytes = Buffer.byteLength(jsonString, 'utf8');
    const downloadToken = crypto.randomBytes(24).toString('hex');
    const downloadUrl = `/api/v1/compliance/exports/download/${downloadToken}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day retention for exports

    const exportRecord = await prisma.complianceExport.create({
      data: {
        orgId,
        requestedById,
        type: input.type,
        status: 'COMPLETED',
        downloadUrl,
        filter: input as any,
        fileSizeBytes,
        recordCount,
        expiresAt,
      },
    });

    await AuditService.log({
      orgId,
      userId: requestedById,
      action: 'COMPLIANCE_EXPORT_GENERATED',
      entityType: 'ComplianceExport',
      entityId: exportRecord.id,
      payload: {
        type: input.type,
        recordCount,
        fileSizeBytes,
        targetUserId: input.targetUserId,
      },
    });

    return {
      ...exportRecord,
      exportPayload: exportData,
    };
  }

  /**
   * GDPR Article 17 "Right to Erasure" (Right-to-be-Forgotten):
   * Anonymizes user PII across profile and references while preserving team audit and relational consistency.
   */
  public static async executeGdprForget(
    orgId: string,
    requestedById: string,
    input: GdprForgetInput
  ) {
    const user = await prisma.user.findUnique({
      where: { id: input.targetUserId },
    });

    if (!user) throw new Error('Target user not found');
    if (user.email.toLowerCase() !== input.confirmEmail.toLowerCase()) {
      throw new Error('Confirmation email does not match target user email');
    }

    const pseudonymId = crypto.randomBytes(4).toString('hex');
    const redactedEmail = `redacted-${pseudonymId}@privacy.leaddesk.internal`;
    const redactedName = `Redacted User (#${pseudonymId})`;

    // Perform transaction anonymization
    await prisma.$transaction([
      // 1. Redact User Profile
      prisma.user.update({
        where: { id: input.targetUserId },
        data: {
          displayName: redactedName,
          email: redactedEmail,
          passwordHash: 'REDACTED_GDPR_ERASURE',
          externalId: null,
          isActive: false,
        },
      }),

      // 2. Deactivate Organization Memberships
      prisma.orgMembership.updateMany({
        where: { userId: input.targetUserId },
        data: {
          isActive: false,
        },
      }),

      // 3. Clear Refresh Tokens
      prisma.refreshToken.deleteMany({
        where: { userId: input.targetUserId },
      }),
    ]);

    // Record in Tamper-Evident Merkle Audit Chain
    await AuditService.log({
      orgId,
      userId: requestedById,
      action: 'GDPR_RIGHT_TO_ERASURE',
      entityType: 'User',
      entityId: input.targetUserId,
      payload: {
        targetUserId: input.targetUserId,
        previousEmailSha256: crypto.createHash('sha256').update(user.email).digest('hex'),
        reason: input.reason,
        erasedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      targetUserId: input.targetUserId,
      redactedEmail,
      redactedName,
      message: 'GDPR Right-to-be-Forgotten erasure executed successfully.',
    };
  }

  /**
   * List compliance exports for an organization
   */
  public static async listExports(orgId: string) {
    return prisma.complianceExport.findMany({
      where: { orgId },
      include: {
        requestedBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
