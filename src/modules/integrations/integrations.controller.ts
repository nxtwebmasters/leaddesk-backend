import { Request, Response } from 'express';
import { IntegrationsService } from './integrations.service';
import { createIntegrationSchema, updateIntegrationSchema } from './integrations.types';
import { sendSuccess, sendError } from '../../common/response';

export class IntegrationsController {
  /**
   * List configured integrations
   */
  public static async listIntegrations(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const hostUrl = `${req.protocol}://${req.get('host')}`;
      const integrations = await IntegrationsService.listIntegrations(orgId, hostUrl);
      return sendSuccess(res, { integrations });
    } catch (err: any) {
      console.error('[listIntegrations Error]', err);
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to list integrations', 500);
    }
  }

  /**
   * Get single integration
   */
  public static async getIntegration(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const { id } = req.params;
      const hostUrl = `${req.protocol}://${req.get('host')}`;

      const integration = await IntegrationsService.getIntegration(orgId, id, hostUrl);
      return sendSuccess(res, integration);
    } catch (err: any) {
      return sendError(res, 'NOT_FOUND', err.message || 'Integration not found', 404);
    }
  }

  /**
   * Create new integration
   */
  public static async createIntegration(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const parsed = createIntegrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const hostUrl = `${req.protocol}://${req.get('host')}`;
      const created = await IntegrationsService.createIntegration(orgId, parsed.data, hostUrl);
      return sendSuccess(res, created, undefined, 201);
    } catch (err: any) {
      console.error('[createIntegration Error]', err);
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to create integration', 400);
    }
  }

  /**
   * Update integration
   */
  public static async updateIntegration(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const { id } = req.params;

      const parsed = updateIntegrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const updated = await IntegrationsService.updateIntegration(orgId, id, parsed.data);
      return sendSuccess(res, updated);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to update integration', 400);
    }
  }

  /**
   * Delete integration
   */
  public static async deleteIntegration(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const { id } = req.params;

      await IntegrationsService.deleteIntegration(orgId, id);
      return sendSuccess(res, { message: 'Integration deleted successfully' });
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to delete integration', 400);
    }
  }

  /**
   * Universal Webhook Ingress (Event Mesh)
   */
  public static async handleWebhook(req: Request, res: Response) {
    try {
      const { integrationId, provider } = req.params;
      const eventType =
        (req.headers['x-github-event'] as string) ||
        (req.headers['x-gitlab-event'] as string) ||
        req.body?.webhookEvent ||
        req.body?.event ||
        provider ||
        'webhook';

      const result = await IntegrationsService.handleInboundEvent(
        integrationId,
        eventType,
        req.body,
        req.headers
      );

      // If Slack responded with a custom payload
      if (result.data?.response) {
        return res.status(200).json(result.data.response);
      }

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[handleWebhook Error]', err);
      return res.status(400).json({ status: 'ERROR', message: err.message || 'Webhook processing failed' });
    }
  }

  /**
   * PR Watchdog Stats
   */
  public static async getPrWatchdogStats(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const stats = await IntegrationsService.getPrWatchdogStats(orgId);
      return sendSuccess(res, stats);
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to fetch PR watchdog stats', 500);
    }
  }

  /**
   * List tracked pull requests
   */
  public static async listPullRequests(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const status = req.query.status as string | undefined;
      const isStalled = req.query.isStalled === 'true' ? true : req.query.isStalled === 'false' ? false : undefined;
      const repository = req.query.repository as string | undefined;

      const pullRequests = await IntegrationsService.listPullRequests(orgId, { status, isStalled, repository });
      return sendSuccess(res, { pullRequests });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to list pull requests', 500);
    }
  }

  /**
   * Trigger on-demand PR SLA scan
   */
  public static async triggerPrScan(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const scanResult = await IntegrationsService.triggerPrScan(orgId);
      return sendSuccess(res, scanResult);
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to scan pull requests', 500);
    }
  }

  /**
   * List Event Mesh logs
   */
  public static async listEvents(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const take = req.query.take ? parseInt(req.query.take as string, 10) : 50;
      const events = await IntegrationsService.listEvents(orgId, take);
      return sendSuccess(res, { events });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to fetch integration events', 500);
    }
  }
}
