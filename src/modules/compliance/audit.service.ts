import crypto from 'crypto';
import { prisma } from '../../common/prisma';
import { ListAuditLogsQuery, MerkleVerificationResult } from './compliance.types';

export interface CreateAuditLogParams {
  orgId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  payload?: any;
}

export class AuditService {
  /**
   * Deterministically stringify object with sorted keys for consistent hashing
   */
  public static canonicalJson(obj: any): string {
    if (obj === null || obj === undefined) return '{}';
    if (typeof obj !== 'object' || Array.isArray(obj)) return JSON.stringify(obj);

    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: Record<string, any> = {};
    for (const key of sortedKeys) {
      sortedObj[key] = obj[key];
    }
    return JSON.stringify(sortedObj);
  }

  /**
   * Compute cryptographic SHA-256 hash for a Merkle chain block
   */
  public static computeBlockHash(
    prevHash: string,
    orgId: string,
    action: string,
    entityType: string,
    entityId: string | null | undefined,
    createdAt: Date,
    payload: any
  ): string {
    const rawContent = [
      prevHash,
      orgId,
      action,
      entityType,
      entityId || '',
      createdAt.toISOString(),
      this.canonicalJson(payload),
    ].join('|');

    return crypto.createHash('sha256').update(rawContent).digest('hex');
  }

  /**
   * Append a tamper-evident audit log record to the organization's Merkle chain
   */
  public static async log(params: CreateAuditLogParams) {
    const { orgId, userId, action, entityType, entityId, ipAddress, userAgent, payload } = params;

    // Fetch the latest audit log in this tenant to link to its hash
    const latestLog = await prisma.auditLog.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });

    const prevHash = latestLog ? latestLog.hash : 'GENESIS_BLOCK_00000000000000000000000000000000000000000000000000000000';
    const now = new Date();
    const hash = this.computeBlockHash(prevHash, orgId, action, entityType, entityId, now, payload);

    return prisma.auditLog.create({
      data: {
        orgId,
        userId: userId || null,
        action,
        entityType,
        entityId: entityId || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        payload: payload || null,
        prevHash,
        hash,
        createdAt: now,
      },
    });
  }

  /**
   * Verify cryptographic chain integrity across all audit logs in an organization
   */
  public static async verifyIntegrity(orgId: string): Promise<MerkleVerificationResult> {
    const logs = await prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) {
      return {
        isValid: true,
        checkedRecords: 0,
      };
    }

    const genesisPrevHash = 'GENESIS_BLOCK_00000000000000000000000000000000000000000000000000000000';

    for (let i = 0; i < logs.length; i++) {
      const current = logs[i];
      const expectedPrevHash = i === 0 ? genesisPrevHash : logs[i - 1].hash;

      // 1. Verify link to previous block
      if (current.prevHash !== expectedPrevHash) {
        return {
          isValid: false,
          checkedRecords: i,
          breachedRecordId: current.id,
          error: `Chain broken at record #${i + 1} (${current.id}): prevHash mismatch. Expected ${expectedPrevHash.substring(0, 16)}..., got ${current.prevHash.substring(0, 16)}...`,
        };
      }

      // 2. Recompute and verify current block's hash
      const recomputed = this.computeBlockHash(
        current.prevHash,
        current.orgId,
        current.action,
        current.entityType,
        current.entityId,
        current.createdAt,
        current.payload
      );

      if (current.hash !== recomputed) {
        return {
          isValid: false,
          checkedRecords: i,
          breachedRecordId: current.id,
          error: `Payload tampering detected at record #${i + 1} (${current.id}): Hash signature invalid. Expected ${recomputed.substring(0, 16)}..., got stored hash ${current.hash.substring(0, 16)}...`,
        };
      }
    }

    return {
      isValid: true,
      checkedRecords: logs.length,
    };
  }

  /**
   * Filter and list audit logs
   */
  public static async listLogs(orgId: string, query: ListAuditLogsQuery) {
    const where: any = { orgId };

    if (query.action) where.action = query.action;
    if (query.entityType) where.entityType = query.entityType;
    if (query.userId) where.userId = query.userId;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }
}
