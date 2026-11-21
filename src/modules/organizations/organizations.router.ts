import { Router } from 'express';
import { OrganizationsController } from './organizations.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';
import { tenantContext, requireOrgRole } from '../../common/middleware/tenant.middleware';
import { OrgRole } from '@prisma/client';

export const organizationsRouter = Router();

organizationsRouter.use(authenticateJwt);

// User Organizations
organizationsRouter.get('/my', OrganizationsController.getMyOrganizations);
organizationsRouter.post('/', OrganizationsController.createOrganization);
organizationsRouter.post('/invitations/accept', OrganizationsController.acceptInvitation);

// Organization Specific
organizationsRouter.get('/:id', tenantContext, OrganizationsController.getOrganizationDetails);
organizationsRouter.patch(
  '/:id',
  tenantContext,
  requireOrgRole(OrgRole.OWNER, OrgRole.ORG_ADMIN),
  OrganizationsController.updateOrganization
);

// Workspaces & Teams
organizationsRouter.post(
  '/:id/workspaces',
  tenantContext,
  requireOrgRole(OrgRole.OWNER, OrgRole.ORG_ADMIN, OrgRole.DIRECTOR),
  OrganizationsController.createWorkspace
);

organizationsRouter.post(
  '/:id/teams',
  tenantContext,
  requireOrgRole(OrgRole.OWNER, OrgRole.ORG_ADMIN, OrgRole.DIRECTOR, OrgRole.MANAGER),
  OrganizationsController.createTeam
);

// Member Invites & Management
organizationsRouter.post(
  '/:id/invitations',
  tenantContext,
  requireOrgRole(OrgRole.OWNER, OrgRole.ORG_ADMIN),
  OrganizationsController.inviteMember
);

organizationsRouter.patch(
  '/:id/members/:memberId',
  tenantContext,
  requireOrgRole(OrgRole.OWNER, OrgRole.ORG_ADMIN),
  OrganizationsController.updateMember
);

organizationsRouter.delete(
  '/:id/members/:memberId',
  tenantContext,
  requireOrgRole(OrgRole.OWNER, OrgRole.ORG_ADMIN),
  OrganizationsController.removeMember
);

// Visual Hierarchy Tree
organizationsRouter.get('/:id/hierarchy', tenantContext, OrganizationsController.getHierarchyTree);
