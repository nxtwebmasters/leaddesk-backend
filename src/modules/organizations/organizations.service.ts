import crypto from 'crypto';
import { prisma } from '../../common/prisma';
import { OrgRole } from '@prisma/client';
import {
  CreateOrgInput,
  UpdateOrgInput,
  CreateWorkspaceInput,
  CreateTeamInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
} from './organizations.types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class OrganizationsService {
  static async createOrganization(userId: string, input: CreateOrgInput) {
    const slug = `${slugify(input.name)}-${crypto.randomBytes(3).toString('hex')}`;

    const org = await prisma.organization.create({
      data: {
        name: input.name,
        slug,
        domain: input.domain || null,
        logoUrl: input.logoUrl || null,
      },
    });

    // Create primary workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Core Engineering',
        slug: 'core-eng',
        description: 'Primary engineering workspace',
        orgId: org.id,
      },
    });

    // Create primary squad
    await prisma.team.create({
      data: {
        name: 'Platform Pod',
        description: 'Foundational platform team',
        workspaceId: workspace.id,
        leadUserId: userId,
      },
    });

    // Assign creating user as OWNER
    const membership = await prisma.orgMembership.create({
      data: {
        orgId: org.id,
        userId,
        role: OrgRole.OWNER,
        title: 'Founder / Engineering Lead',
        department: 'Executive',
      },
      include: {
        organization: true,
      },
    });

    return {
      organization: org,
      membership,
    };
  }

  static async getMyOrganizations(userId: string) {
    const memberships = await prisma.orgMembership.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            workspaces: {
              include: {
                teams: true,
              },
            },
            _count: {
              select: {
                memberships: true,
                workspaces: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m: any) => ({
      membershipId: m.id,
      role: m.role,
      title: m.title,
      department: m.department,
      organization: m.organization,
    }));
  }

  static async getOrganizationDetails(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        workspaces: {
          include: {
            teams: {
              include: {
                leadUser: {
                  select: {
                    id: true,
                    displayName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
                timezone: true,
              },
            },
            reportsTo: {
              include: {
                user: {
                  select: {
                    displayName: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
        invitations: {
          where: { expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    return org;
  }

  static async updateOrganization(orgId: string, input: UpdateOrgInput) {
    return prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.domain !== undefined ? { domain: input.domain } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      },
    });
  }

  static async createWorkspace(orgId: string, input: CreateWorkspaceInput) {
    const slug = `${slugify(input.name)}-${crypto.randomBytes(2).toString('hex')}`;
    return prisma.workspace.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        parentId: input.parentId || null,
        orgId,
      },
    });
  }

  static async createTeam(workspaceId: string, input: CreateTeamInput) {
    return prisma.team.create({
      data: {
        name: input.name,
        description: input.description,
        workspaceId,
        leadUserId: input.leadUserId || null,
      },
    });
  }

  static async inviteMember(orgId: string, invitedById: string, input: InviteMemberInput) {
    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      const existingMembership = await prisma.orgMembership.findUnique({
        where: {
          orgId_userId: {
            orgId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMembership) {
        throw new Error('User is already a member of this organization');
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiration

    const invitation = await prisma.orgInvitation.create({
      data: {
        orgId,
        email: input.email,
        role: input.role,
        token,
        expiresAt,
        invitedById,
      },
    });

    return invitation;
  }

  static async acceptInvitation(userId: string, token: string) {
    const invitation = await prisma.orgInvitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new Error('Invalid invitation link');
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }

    const membership = await prisma.orgMembership.create({
      data: {
        orgId: invitation.orgId,
        userId,
        role: invitation.role,
        title: 'Team Member',
      },
      include: {
        organization: true,
      },
    });

    // Delete used invitation
    await prisma.orgInvitation.delete({
      where: { id: invitation.id },
    });

    return membership;
  }

  static async updateMember(membershipId: string, input: UpdateMemberRoleInput) {
    return prisma.orgMembership.update({
      where: { id: membershipId },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
        ...(input.reportsToId !== undefined ? { reportsToId: input.reportsToId } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });
  }

  static async removeMember(orgId: string, membershipId: string) {
    const membership = await prisma.orgMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.orgId !== orgId) {
      throw new Error('Membership not found');
    }

    if (membership.role === OrgRole.OWNER) {
      const ownerCount = await prisma.orgMembership.count({
        where: { orgId, role: OrgRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new Error('Cannot remove the sole owner of an organization');
      }
    }

    return prisma.orgMembership.delete({
      where: { id: membershipId },
    });
  }

  static async getHierarchyTree(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        workspaces: {
          include: {
            teams: {
              include: {
                leadUser: {
                  select: {
                    id: true,
                    displayName: true,
                    email: true,
                  },
                },
                memberships: {
                  include: {
                    orgMembership: {
                      include: {
                        user: {
                          select: {
                            id: true,
                            displayName: true,
                            email: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
            directReports: {
              include: {
                user: {
                  select: {
                    displayName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    return org;
  }

  static async getSsoConfig(orgId: string, hostUrl?: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        ssoEnabled: true,
        ssoProvider: true,
        ssoEntityId: true,
        ssoLoginUrl: true,
        ssoAcsUrl: true,
        ssoCert: true,
        ssoMetadataUrl: true,
        enforceSso: true,
        allowedDomains: true,
        scimEnabled: true,
        scimApiKey: true,
      },
    });

    if (!org) throw new Error('Organization not found');

    const baseHost = hostUrl || 'http://localhost:4000';
    return {
      ...org,
      spEntityId: `${baseHost}/api/v1/auth/sso/metadata/${org.id}`,
      spAcsUrl: `${baseHost}/api/v1/auth/sso/callback`,
      spMetadataUrl: `${baseHost}/api/v1/auth/sso/metadata/${org.id}`,
      scimBaseUrl: `${baseHost}/scim/v2`,
    };
  }

  static async updateSsoConfig(orgId: string, input: any) {
    return prisma.organization.update({
      where: { id: orgId },
      data: {
        ssoEnabled: input.ssoEnabled ?? false,
        ssoProvider: input.ssoProvider || null,
        ssoEntityId: input.ssoEntityId || null,
        ssoLoginUrl: input.ssoLoginUrl || null,
        ssoAcsUrl: input.ssoAcsUrl || null,
        ssoCert: input.ssoCert || null,
        ssoMetadataUrl: input.ssoMetadataUrl || null,
        enforceSso: input.enforceSso ?? false,
        allowedDomains: Array.isArray(input.allowedDomains) ? input.allowedDomains : [],
      },
      select: {
        id: true,
        ssoEnabled: true,
        ssoProvider: true,
        ssoEntityId: true,
        ssoLoginUrl: true,
        ssoAcsUrl: true,
        ssoCert: true,
        ssoMetadataUrl: true,
        enforceSso: true,
        allowedDomains: true,
      },
    });
  }

  static async generateScimToken(orgId: string) {
    const token = `ld_scim_${crypto.randomBytes(24).toString('hex')}`;
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        scimApiKey: token,
        scimEnabled: true,
      },
      select: {
        id: true,
        scimEnabled: true,
        scimApiKey: true,
      },
    });
    return org;
  }

  static async revokeScimToken(orgId: string) {
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        scimApiKey: null,
        scimEnabled: false,
      },
      select: {
        id: true,
        scimEnabled: true,
      },
    });
    return org;
  }
}
