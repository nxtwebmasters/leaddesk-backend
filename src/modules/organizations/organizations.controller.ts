import { Request, Response } from 'express';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrgSchema,
  UpdateOrgSchema,
  CreateWorkspaceSchema,
  CreateTeamSchema,
  InviteMemberSchema,
  AcceptInviteSchema,
  UpdateMemberRoleSchema,
} from './organizations.types';
import { updateSsoConfigSchema } from '../auth/sso/sso.types';
import { sendSuccess, sendError } from '../../common/response';

export class OrganizationsController {
  static async createOrganization(req: Request, res: Response) {
    try {
      const parsed = CreateOrgSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const userId = (req as any).user.userId;
      const result = await OrganizationsService.createOrganization(userId, parsed.data);
      return sendSuccess(res, result, undefined, 201);
    } catch (error: any) {
      console.error('createOrganization error:', error);
      return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to create organization', 500);
    }
  }

  static async getMyOrganizations(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const orgs = await OrganizationsService.getMyOrganizations(userId);
      return sendSuccess(res, { organizations: orgs });
    } catch (error: any) {
      console.error('getMyOrganizations error:', error);
      return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to fetch organizations', 500);
    }
  }

  static async getOrganizationDetails(req: Request, res: Response) {
    try {
      const orgId = req.params.id;
      const org = await OrganizationsService.getOrganizationDetails(orgId);
      return sendSuccess(res, { organization: org });
    } catch (error: any) {
      console.error('getOrganizationDetails error:', error);
      return sendError(res, 'NOT_FOUND', error.message || 'Organization not found', 404);
    }
  }

  static async updateOrganization(req: Request, res: Response) {
    try {
      const parsed = UpdateOrgSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const orgId = req.params.id;
      const updated = await OrganizationsService.updateOrganization(orgId, parsed.data);
      return sendSuccess(res, { organization: updated });
    } catch (error: any) {
      console.error('updateOrganization error:', error);
      return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to update organization', 500);
    }
  }

  static async createWorkspace(req: Request, res: Response) {
    try {
      const parsed = CreateWorkspaceSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const orgId = req.params.id;
      const workspace = await OrganizationsService.createWorkspace(orgId, parsed.data);
      return sendSuccess(res, { workspace }, undefined, 201);
    } catch (error: any) {
      console.error('createWorkspace error:', error);
      return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to create workspace', 500);
    }
  }

  static async createTeam(req: Request, res: Response) {
    try {
      const parsed = CreateTeamSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const team = await OrganizationsService.createTeam(parsed.data.workspaceId, parsed.data);
      return sendSuccess(res, { team }, undefined, 201);
    } catch (error: any) {
      console.error('createTeam error:', error);
      return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to create team', 500);
    }
  }

  static async inviteMember(req: Request, res: Response) {
    try {
      const parsed = InviteMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const orgId = req.params.id;
      const invitedById = (req as any).user.userId;
      const invitation = await OrganizationsService.inviteMember(orgId, invitedById, parsed.data);
      return sendSuccess(res, { invitation }, undefined, 201);
    } catch (error: any) {
      console.error('inviteMember error:', error);
      if (error.message.includes('already a member')) {
        return sendError(res, 'CONFLICT', error.message, 409);
      }
      return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to send invitation', 500);
    }
  }

  static async acceptInvitation(req: Request, res: Response) {
    try {
      const parsed = AcceptInviteSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const userId = (req as any).user.userId;
      const membership = await OrganizationsService.acceptInvitation(userId, parsed.data.token);
      return sendSuccess(res, { membership });
    } catch (error: any) {
      console.error('acceptInvitation error:', error);
      return sendError(res, 'BAD_REQUEST', error.message || 'Failed to accept invitation', 400);
    }
  }

  static async updateMember(req: Request, res: Response) {
    try {
      const parsed = UpdateMemberRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const memberId = req.params.memberId;
      const updated = await OrganizationsService.updateMember(memberId, parsed.data);
      return sendSuccess(res, { member: updated });
    } catch (error: any) {
      console.error('updateMember error:', error);
      return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to update member', 500);
    }
  }

  static async removeMember(req: Request, res: Response) {
    try {
      const { id: orgId, memberId } = req.params;
      await OrganizationsService.removeMember(orgId, memberId);
      return sendSuccess(res, { message: 'Member removed successfully' });
    } catch (error: any) {
      console.error('removeMember error:', error);
      return sendError(res, 'BAD_REQUEST', error.message || 'Failed to remove member', 400);
    }
  }

  static async getHierarchyTree(req: Request, res: Response) {
    try {
      const orgId = req.params.id;
      const tree = await OrganizationsService.getHierarchyTree(orgId);
      return sendSuccess(res, { hierarchy: tree });
    } catch (error: any) {
      console.error('getHierarchyTree error:', error);
      return sendError(res, 'NOT_FOUND', error.message || 'Organization not found', 404);
    }
  }

  static async getSsoConfig(req: Request, res: Response) {
    try {
      const orgId = req.params.id;
      const hostUrl = `${req.protocol}://${req.get('host')}`;
      const config = await OrganizationsService.getSsoConfig(orgId, hostUrl);
      return sendSuccess(res, config);
    } catch (error: any) {
      console.error('getSsoConfig error:', error);
      return sendError(res, 'NOT_FOUND', error.message || 'Failed to load SSO configuration', 404);
    }
  }

  static async updateSsoConfig(req: Request, res: Response) {
    try {
      const orgId = req.params.id;
      const parsed = updateSsoConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid SSO configuration', 400);
      }
      const updated = await OrganizationsService.updateSsoConfig(orgId, parsed.data);
      return sendSuccess(res, updated);
    } catch (error: any) {
      console.error('updateSsoConfig error:', error);
      return sendError(res, 'BAD_REQUEST', error.message || 'Failed to update SSO configuration', 400);
    }
  }

  static async generateScimToken(req: Request, res: Response) {
    try {
      const orgId = req.params.id;
      const result = await OrganizationsService.generateScimToken(orgId);
      return sendSuccess(res, result);
    } catch (error: any) {
      console.error('generateScimToken error:', error);
      return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to generate SCIM token', 500);
    }
  }

  static async revokeScimToken(req: Request, res: Response) {
    try {
      const orgId = req.params.id;
      const result = await OrganizationsService.revokeScimToken(orgId);
      return sendSuccess(res, result);
    } catch (error: any) {
      console.error('revokeScimToken error:', error);
      return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to revoke SCIM token', 500);
    }
  }
}
