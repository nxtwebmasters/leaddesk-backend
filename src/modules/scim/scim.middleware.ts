import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../common/prisma';
import { SCIM_ERROR_SCHEMA } from './scim.types';

export interface ScimRequest extends Request {
  scimOrg?: {
    id: string;
    name: string;
    slug: string;
    domain: string | null;
  };
}

export async function authenticateScim(req: ScimRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.setHeader('Content-Type', 'application/scim+json');
    return res.status(401).json({
      schemas: [SCIM_ERROR_SCHEMA],
      status: '401',
      detail: 'Missing or malformed Authorization header. Expected: Bearer <scim-api-key>',
    });
  }

  const token = authHeader.substring(7).trim();

  try {
    const org = await prisma.organization.findUnique({
      where: { scimApiKey: token },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        scimEnabled: true,
      },
    });

    if (!org || !org.scimEnabled) {
      res.setHeader('Content-Type', 'application/scim+json');
      return res.status(401).json({
        schemas: [SCIM_ERROR_SCHEMA],
        status: '401',
        detail: 'Invalid SCIM Bearer token or SCIM provisioning is disabled for this organization.',
      });
    }

    req.scimOrg = org;
    return next();
  } catch (error: any) {
    console.error('[SCIM Auth Error]', error);
    res.setHeader('Content-Type', 'application/scim+json');
    return res.status(500).json({
      schemas: [SCIM_ERROR_SCHEMA],
      status: '500',
      detail: 'Internal server error validating SCIM credentials.',
    });
  }
}
