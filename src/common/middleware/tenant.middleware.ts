import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { sendError } from '../response';
import { OrgRole } from '../../modules/organizations/organizations.types';

declare global {
  namespace Express {
    interface Request {
      orgId?: string;
      orgRole?: OrgRole;
      orgMembership?: any;
    }
  }
}

export async function tenantContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    return next();
  }

  const requestedOrgId = (req.headers['x-org-id'] as string) || (req.query.orgId as string);

  try {
    let membership;
    if (requestedOrgId) {
      membership = await prisma.orgMembership.findUnique({
        where: {
          orgId_userId: {
            orgId: requestedOrgId,
            userId,
          },
        },
        include: {
          organization: true,
        },
      });
    }

    if (!membership) {
      // Find the user's primary/first organization
      membership = await prisma.orgMembership.findFirst({
        where: { userId },
        orderBy: [{ joinedAt: 'asc' }],
        include: {
          organization: true,
        },
      });
    }

    if (membership) {
      req.orgId = membership.orgId;
      req.orgRole = membership.role;
      req.orgMembership = membership;
    }

    next();
  } catch (error) {
    console.error('tenantContext error:', error);
    next();
  }
}

export function requireOrgRole(...allowedRoles: OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.orgMembership || !req.orgRole) {
      sendError(res, 'FORBIDDEN', 'Organization membership required.', 403);
      return;
    }

    // OWNER always has full access
    if (req.orgRole === OrgRole.OWNER || allowedRoles.includes(req.orgRole)) {
      return next();
    }

    sendError(
      res,
      'FORBIDDEN',
      `Insufficient permissions. Requires one of: ${allowedRoles.join(', ')}`,
      403
    );
  };
}
