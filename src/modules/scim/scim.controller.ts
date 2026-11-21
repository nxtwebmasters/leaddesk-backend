import { Response } from 'express';
import { ScimRequest } from './scim.middleware';
import { ScimService } from './scim.service';
import {
  SCIM_ERROR_SCHEMA,
  SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA,
  SCIM_RESOURCE_TYPE_SCHEMA,
  SCIM_USER_SCHEMA,
} from './scim.types';

export class ScimController {
  private static sendScimError(res: Response, status: number, detail: string, scimType?: string) {
    res.setHeader('Content-Type', 'application/scim+json');
    return res.status(status).json({
      schemas: [SCIM_ERROR_SCHEMA],
      status: String(status),
      scimType,
      detail,
    });
  }

  /**
   * RFC 7643 ServiceProviderConfig discovery
   */
  public static async getServiceProviderConfig(req: ScimRequest, res: Response) {
    res.setHeader('Content-Type', 'application/scim+json');
    return res.status(200).json({
      schemas: [SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA],
      documentationUri: 'https://tools.ietf.org/html/rfc7644',
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 500 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          name: 'OAuth Bearer Token',
          description: 'Authentication scheme using the OAuth Bearer Standard',
          specUri: 'https://tools.ietf.org/html/rfc6750',
          type: 'oauthbearertoken',
          primary: true,
        },
      ],
    });
  }

  /**
   * RFC 7643 ResourceTypes discovery
   */
  public static async getResourceTypes(req: ScimRequest, res: Response) {
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    res.setHeader('Content-Type', 'application/scim+json');
    return res.status(200).json([
      {
        schemas: [SCIM_RESOURCE_TYPE_SCHEMA],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'LeadDesk User Account',
        schema: SCIM_USER_SCHEMA,
        meta: {
          location: `${hostUrl}/scim/v2/ResourceTypes/User`,
          resourceType: 'ResourceType',
        },
      },
    ]);
  }

  /**
   * RFC 7643 Schemas discovery
   */
  public static async getSchemas(req: ScimRequest, res: Response) {
    res.setHeader('Content-Type', 'application/scim+json');
    return res.status(200).json([
      {
        id: SCIM_USER_SCHEMA,
        name: 'User',
        description: 'Core User Schema',
        attributes: [
          { name: 'userName', type: 'string', required: true, uniqueness: 'server' },
          { name: 'displayName', type: 'string', required: false },
          { name: 'name', type: 'complex', required: false },
          { name: 'emails', type: 'complex', multiValued: true, required: true },
          { name: 'active', type: 'boolean', required: false },
          { name: 'title', type: 'string', required: false },
          { name: 'department', type: 'string', required: false },
        ],
      },
    ]);
  }

  /**
   * RFC 7644 GET /Users
   */
  public static async listUsers(req: ScimRequest, res: Response) {
    try {
      const orgId = req.scimOrg!.id;
      const hostUrl = `${req.protocol}://${req.get('host')}`;
      const filter = req.query.filter as string | undefined;
      const startIndex = req.query.startIndex ? parseInt(req.query.startIndex as string, 10) : 1;
      const count = req.query.count ? parseInt(req.query.count as string, 10) : 100;

      const result = await ScimService.listUsers(orgId, filter, startIndex, count, hostUrl);
      res.setHeader('Content-Type', 'application/scim+json');
      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[SCIM listUsers Error]', err);
      return ScimController.sendScimError(res, 500, err.message || 'Error listing SCIM users');
    }
  }

  /**
   * RFC 7644 GET /Users/:id
   */
  public static async getUser(req: ScimRequest, res: Response) {
    try {
      const orgId = req.scimOrg!.id;
      const hostUrl = `${req.protocol}://${req.get('host')}`;
      const userId = req.params.id;

      const user = await ScimService.getUser(orgId, userId, hostUrl);
      res.setHeader('Content-Type', 'application/scim+json');
      return res.status(200).json(user);
    } catch (err: any) {
      return ScimController.sendScimError(res, 404, err.message || 'SCIM user not found');
    }
  }

  /**
   * RFC 7644 POST /Users (Automated Onboarding)
   */
  public static async createUser(req: ScimRequest, res: Response) {
    try {
      const orgId = req.scimOrg!.id;
      const hostUrl = `${req.protocol}://${req.get('host')}`;

      const created = await ScimService.createUser(orgId, req.body, hostUrl);
      res.setHeader('Content-Type', 'application/scim+json');
      res.setHeader('Location', `${hostUrl}/scim/v2/Users/${created.id}`);
      return res.status(201).json(created);
    } catch (err: any) {
      console.error('[SCIM createUser Error]', err);
      return ScimController.sendScimError(res, 400, err.message || 'Failed to provision SCIM user');
    }
  }

  /**
   * RFC 7644 PUT /Users/:id
   */
  public static async updateUser(req: ScimRequest, res: Response) {
    try {
      const orgId = req.scimOrg!.id;
      const hostUrl = `${req.protocol}://${req.get('host')}`;
      const userId = req.params.id;

      const updated = await ScimService.updateUser(orgId, userId, req.body, hostUrl);
      res.setHeader('Content-Type', 'application/scim+json');
      return res.status(200).json(updated);
    } catch (err: any) {
      console.error('[SCIM updateUser Error]', err);
      return ScimController.sendScimError(res, 400, err.message || 'Failed to update SCIM user');
    }
  }

  /**
   * RFC 7644 PATCH /Users/:id
   */
  public static async patchUser(req: ScimRequest, res: Response) {
    try {
      const orgId = req.scimOrg!.id;
      const hostUrl = `${req.protocol}://${req.get('host')}`;
      const userId = req.params.id;
      const operations = req.body.Operations || [];

      const patched = await ScimService.patchUser(orgId, userId, operations, hostUrl);
      res.setHeader('Content-Type', 'application/scim+json');
      return res.status(200).json(patched);
    } catch (err: any) {
      console.error('[SCIM patchUser Error]', err);
      return ScimController.sendScimError(res, 400, err.message || 'Failed to patch SCIM user');
    }
  }

  /**
   * RFC 7644 DELETE /Users/:id (Automated Offboarding)
   */
  public static async deleteUser(req: ScimRequest, res: Response) {
    try {
      const orgId = req.scimOrg!.id;
      const userId = req.params.id;

      await ScimService.deleteUser(orgId, userId);
      return res.status(204).send();
    } catch (err: any) {
      console.error('[SCIM deleteUser Error]', err);
      return ScimController.sendScimError(res, 404, err.message || 'SCIM user not found');
    }
  }
}
