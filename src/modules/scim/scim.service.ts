import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../common/prisma';
import {
  SCIM_USER_SCHEMA,
  SCIM_LIST_SCHEMA,
  ScimUserResource,
  ScimListResponse,
  ScimPatchOperation,
} from './scim.types';

export class ScimService {
  /**
   * Helper to format a LeadDesk user & membership into an RFC 7643 User Resource
   */
  private static formatScimUser(
    user: {
      id: string;
      email: string;
      displayName: string;
      isActive: boolean;
      externalId: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    membership: {
      title: string | null;
      department: string | null;
      isActive: boolean;
    },
    hostUrl: string
  ): ScimUserResource {
    const nameParts = user.displayName.split(' ');
    const givenName = nameParts[0] || '';
    const familyName = nameParts.slice(1).join(' ') || '';

    return {
      schemas: [SCIM_USER_SCHEMA],
      id: user.id,
      externalId: user.externalId,
      userName: user.email,
      displayName: user.displayName,
      name: {
        formatted: user.displayName,
        givenName,
        familyName,
      },
      title: membership.title,
      department: membership.department,
      active: user.isActive && membership.isActive,
      emails: [
        {
          value: user.email,
          type: 'work',
          primary: true,
        },
      ],
      meta: {
        resourceType: 'User',
        created: user.createdAt.toISOString(),
        lastModified: user.updatedAt.toISOString(),
        location: `${hostUrl}/scim/v2/Users/${user.id}`,
      },
    };
  }

  /**
   * List users in the organization with SCIM pagination and filtering
   */
  public static async listUsers(
    orgId: string,
    filter?: string,
    startIndex = 1,
    count = 100,
    hostUrl = 'http://localhost:4000'
  ): Promise<ScimListResponse<ScimUserResource>> {
    const where: any = {
      orgId,
    };

    if (filter) {
      // Basic SCIM filter parser: e.g. userName eq "user@example.com"
      const eqMatch = filter.match(/(?:userName|emails\.value|externalId)\s+eq\s+["']?([^"']+)["']?/i);
      if (eqMatch && eqMatch[1]) {
        const val = eqMatch[1].trim();
        where.user = {
          OR: [
            { email: { equals: val, mode: 'insensitive' } },
            { externalId: { equals: val } },
          ],
        };
      }
    }

    const safeStartIndex = Math.max(1, startIndex);
    const safeCount = Math.max(1, Math.min(count, 500));
    const skip = safeStartIndex - 1;

    const [totalResults, memberships] = await Promise.all([
      prisma.orgMembership.count({ where }),
      prisma.orgMembership.findMany({
        where,
        include: {
          user: true,
        },
        skip,
        take: safeCount,
        orderBy: { joinedAt: 'asc' },
      }),
    ]);

    const resources = memberships.map((m) =>
      this.formatScimUser(m.user, m, hostUrl)
    );

    return {
      schemas: [SCIM_LIST_SCHEMA],
      totalResults,
      startIndex: safeStartIndex,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  }

  /**
   * Get single SCIM User by ID
   */
  public static async getUser(orgId: string, userId: string, hostUrl: string): Promise<ScimUserResource> {
    const membership = await prisma.orgMembership.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId,
        },
      },
      include: {
        user: true,
      },
    });

    if (!membership) {
      throw new Error(`SCIM User ${userId} not found in this organization`);
    }

    return this.formatScimUser(membership.user, membership, hostUrl);
  }

  /**
   * Provision new User into LeadDesk Organization (RFC 7644 POST /Users)
   */
  public static async createUser(orgId: string, payload: any, hostUrl: string): Promise<ScimUserResource> {
    const email =
      payload.userName ||
      (Array.isArray(payload.emails) && payload.emails[0]?.value);

    if (!email || typeof email !== 'string') {
      throw new Error('SCIM payload must contain a valid userName or email');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const displayName =
      payload.displayName ||
      payload.name?.formatted ||
      [payload.name?.givenName, payload.name?.familyName].filter(Boolean).join(' ') ||
      normalizedEmail.split('@')[0];

    const active = payload.active !== false;
    const externalId = payload.externalId || null;
    const title = payload.title || null;
    const department = payload.department || null;

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          displayName,
          passwordHash,
          isActive: active,
          externalId,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: displayName || user.displayName,
          externalId: externalId || user.externalId,
          isActive: active,
        },
      });
    }

    // Find or create OrgMembership
    let membership = await prisma.orgMembership.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      membership = await prisma.orgMembership.create({
        data: {
          orgId,
          userId: user.id,
          role: 'MEMBER',
          title,
          department,
          isActive: active,
        },
      });
    } else {
      membership = await prisma.orgMembership.update({
        where: { id: membership.id },
        data: {
          title: title !== undefined ? title : membership.title,
          department: department !== undefined ? department : membership.department,
          isActive: active,
        },
      });
    }

    return this.formatScimUser(user, membership, hostUrl);
  }

  /**
   * Replace SCIM User (RFC 7644 PUT /Users/:id)
   */
  public static async updateUser(
    orgId: string,
    userId: string,
    payload: any,
    hostUrl: string
  ): Promise<ScimUserResource> {
    const membership = await prisma.orgMembership.findUnique({
      where: { orgId_userId: { orgId, userId } },
      include: { user: true },
    });

    if (!membership) {
      throw new Error(`SCIM User ${userId} not found`);
    }

    const active = payload.active !== undefined ? Boolean(payload.active) : membership.isActive;
    const displayName =
      payload.displayName ||
      payload.name?.formatted ||
      [payload.name?.givenName, payload.name?.familyName].filter(Boolean).join(' ') ||
      membership.user.displayName;

    const [updatedUser, updatedMembership] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          displayName,
          isActive: active,
          externalId: payload.externalId !== undefined ? payload.externalId : membership.user.externalId,
        },
      }),
      prisma.orgMembership.update({
        where: { id: membership.id },
        data: {
          isActive: active,
          title: payload.title !== undefined ? payload.title : membership.title,
          department: payload.department !== undefined ? payload.department : membership.department,
        },
      }),
    ]);

    // If deactivated, revoke active sessions
    if (!active) {
      await prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    return this.formatScimUser(updatedUser, updatedMembership, hostUrl);
  }

  /**
   * Apply SCIM PATCH operations (RFC 7644 PATCH /Users/:id)
   */
  public static async patchUser(
    orgId: string,
    userId: string,
    operations: ScimPatchOperation[],
    hostUrl: string
  ): Promise<ScimUserResource> {
    const membership = await prisma.orgMembership.findUnique({
      where: { orgId_userId: { orgId, userId } },
      include: { user: true },
    });

    if (!membership) {
      throw new Error(`SCIM User ${userId} not found`);
    }

    let userUpdates: any = {};
    let membershipUpdates: any = {};

    for (const op of operations) {
      const path = (op.path || '').toLowerCase();
      const val = op.value;

      if (path === 'active' || (val && typeof val === 'object' && val.active !== undefined)) {
        const isActive = path === 'active' ? Boolean(val) : Boolean(val.active);
        userUpdates.isActive = isActive;
        membershipUpdates.isActive = isActive;
      }

      if (path === 'title' || (val && typeof val === 'object' && val.title !== undefined)) {
        membershipUpdates.title = path === 'title' ? String(val) : String(val.title);
      }

      if (path === 'department' || (val && typeof val === 'object' && val.department !== undefined)) {
        membershipUpdates.department = path === 'department' ? String(val) : String(val.department);
      }

      if (path === 'displayname' || (val && typeof val === 'object' && val.displayName !== undefined)) {
        userUpdates.displayName = path === 'displayname' ? String(val) : String(val.displayName);
      }

      if (path === 'name.formatted') {
        userUpdates.displayName = String(val);
      }

      if (path === 'externalid') {
        userUpdates.externalId = String(val);
      }
    }

    const [updatedUser, updatedMembership] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: userUpdates,
      }),
      prisma.orgMembership.update({
        where: { id: membership.id },
        data: membershipUpdates,
      }),
    ]);

    // If deactivated in patch, revoke tokens immediately
    if (userUpdates.isActive === false || membershipUpdates.isActive === false) {
      await prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    return this.formatScimUser(updatedUser, updatedMembership, hostUrl);
  }

  /**
   * De-provision SCIM user (RFC 7644 DELETE /Users/:id)
   */
  public static async deleteUser(orgId: string, userId: string): Promise<void> {
    const membership = await prisma.orgMembership.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });

    if (!membership) {
      throw new Error(`SCIM User ${userId} not found in this organization`);
    }

    // Mark inactive and revoke tokens (safe de-provisioning)
    await prisma.$transaction([
      prisma.orgMembership.update({
        where: { id: membership.id },
        data: { isActive: false },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId },
      }),
    ]);
  }
}
