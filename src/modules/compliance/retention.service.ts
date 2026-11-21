import { prisma } from '../../common/prisma';
import { AuditService } from './audit.service';
import {
  UpsertRetentionPolicyInput,
  ToggleLegalHoldInput,
  PurgeResult,
} from './compliance.types';

export class RetentionService {
  /**
   * Default template policies for enterprise compliance
   */
  private static defaultPolicies = [
    { entityType: 'AUDIT_LOGS', retentionDays: 2555, action: 'ARCHIVE', isActive: true, legalHold: false }, // 7 Years (SOC-2)
    { entityType: 'INTEGRATION_EVENTS', retentionDays: 90, action: 'DELETE', isActive: true, legalHold: false }, // 90 Days
    { entityType: 'INBOX_ITEMS', retentionDays: 365, action: 'DELETE', isActive: true, legalHold: false }, // 1 Year
    { entityType: 'TASKS', retentionDays: 730, action: 'ARCHIVE', isActive: true, legalHold: false }, // 2 Years
    { entityType: 'MEETINGS', retentionDays: 730, action: 'ARCHIVE', isActive: true, legalHold: false }, // 2 Years
  ];

  /**
   * List retention policies for an organization, auto-seeding defaults if not yet configured
   */
  public static async listPolicies(orgId: string) {
    let policies = await prisma.retentionPolicy.findMany({
      where: { orgId },
      orderBy: { entityType: 'asc' },
    });

    if (policies.length === 0) {
      // Seed default baseline policies
      await prisma.retentionPolicy.createMany({
        data: this.defaultPolicies.map((p) => ({
          orgId,
          ...p,
        })),
        skipDuplicates: true,
      });

      policies = await prisma.retentionPolicy.findMany({
        where: { orgId },
        orderBy: { entityType: 'asc' },
      });
    }

    return policies;
  }

  /**
   * Upsert an entity retention policy
   */
  public static async upsertPolicy(
    orgId: string,
    input: UpsertRetentionPolicyInput,
    actorId?: string | null
  ) {
    const policy = await prisma.retentionPolicy.upsert({
      where: {
        orgId_entityType: {
          orgId,
          entityType: input.entityType,
        },
      },
      update: {
        retentionDays: input.retentionDays,
        action: input.action,
        isActive: input.isActive,
        legalHold: input.legalHold,
      },
      create: {
        orgId,
        entityType: input.entityType,
        retentionDays: input.retentionDays,
        action: input.action,
        isActive: input.isActive,
        legalHold: input.legalHold,
      },
    });

    await AuditService.log({
      orgId,
      userId: actorId,
      action: 'RETENTION_POLICY_UPDATE',
      entityType: 'RetentionPolicy',
      entityId: policy.id,
      payload: {
        entityType: input.entityType,
        retentionDays: input.retentionDays,
        action: input.action,
        legalHold: input.legalHold,
      },
    });

    return policy;
  }

  /**
   * Toggle Legal Hold on an entity type (suspends all automatic purges during investigations/audits)
   */
  public static async toggleLegalHold(
    orgId: string,
    input: ToggleLegalHoldInput,
    actorId?: string | null
  ) {
    const policy = await prisma.retentionPolicy.findUnique({
      where: {
        orgId_entityType: {
          orgId,
          entityType: input.entityType,
        },
      },
    });

    let updated;
    if (policy) {
      updated = await prisma.retentionPolicy.update({
        where: { id: policy.id },
        data: { legalHold: input.legalHold },
      });
    } else {
      updated = await prisma.retentionPolicy.create({
        data: {
          orgId,
          entityType: input.entityType,
          retentionDays: 365,
          legalHold: input.legalHold,
        },
      });
    }

    await AuditService.log({
      orgId,
      userId: actorId,
      action: input.legalHold ? 'LEGAL_HOLD_APPLIED' : 'LEGAL_HOLD_RELEASED',
      entityType: 'RetentionPolicy',
      entityId: updated.id,
      payload: {
        entityType: input.entityType,
        legalHold: input.legalHold,
        reason: input.reason || 'Legal investigation / compliance hold requirement',
      },
    });

    return updated;
  }

  /**
   * Execute automated compliance retention purge
   */
  public static async runPurge(orgId: string, actorId?: string | null): Promise<PurgeResult[]> {
    const policies = await prisma.retentionPolicy.findMany({
      where: { orgId, isActive: true },
    });

    const results: PurgeResult[] = [];

    for (const policy of policies) {
      // Strictly block purges if Legal Hold is enabled
      if (policy.legalHold) {
        continue;
      }

      const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
      let purgedCount = 0;

      if (policy.entityType === 'INTEGRATION_EVENTS') {
        const deleted = await prisma.integrationEvent.deleteMany({
          where: {
            orgId,
            createdAt: { lt: cutoffDate },
          },
        });
        purgedCount = deleted.count;
      } else if (policy.entityType === 'INBOX_ITEMS') {
        const deleted = await prisma.inboxItem.deleteMany({
          where: {
            user: {
              orgMemberships: { some: { orgId } },
            },
            status: 'PROCESSED',
            capturedAt: { lt: cutoffDate },
          },
        });
        purgedCount = deleted.count;
      }

      if (purgedCount > 0) {
        results.push({
          entityType: policy.entityType,
          purgedCount,
          retentionDays: policy.retentionDays,
          cutoffDate,
        });

        await AuditService.log({
          orgId,
          userId: actorId,
          action: 'DATA_RETENTION_PURGE',
          entityType: policy.entityType,
          payload: {
            purgedCount,
            retentionDays: policy.retentionDays,
            cutoffDate: cutoffDate.toISOString(),
          },
        });
      }
    }

    return results;
  }
}
