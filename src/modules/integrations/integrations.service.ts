import crypto from 'crypto';
import { prisma } from '../../common/prisma';
import {
  CreateIntegrationInput,
  UpdateIntegrationInput,
  PrWatchdogStats,
} from './integrations.types';
import { GithubWatchdogService } from './github-watchdog.service';
import { JiraLinearSyncService } from './jira-linear-sync.service';
import { SlackTeamsService } from './slack-teams.service';

export class IntegrationsService {
  /**
   * List all configured integrations for organization
   */
  public static async listIntegrations(orgId: string, hostUrl = 'http://localhost:4000') {
    const integrations = await prisma.integration.findMany({
      where: { orgId },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: {
            pullRequests: true,
            events: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return integrations.map((item) => ({
      ...item,
      webhookUrl: `${hostUrl}/api/v1/integrations/webhooks/${item.provider.toLowerCase()}/${item.id}`,
    }));
  }

  /**
   * Get single integration
   */
  public static async getIntegration(orgId: string, id: string, hostUrl = 'http://localhost:4000') {
    const integration = await prisma.integration.findFirst({
      where: { id, orgId },
      include: {
        workspace: true,
      },
    });

    if (!integration) throw new Error('Integration not found');

    return {
      ...integration,
      webhookUrl: `${hostUrl}/api/v1/integrations/webhooks/${integration.provider.toLowerCase()}/${integration.id}`,
    };
  }

  /**
   * Create a new toolchain integration
   */
  public static async createIntegration(
    orgId: string,
    input: CreateIntegrationInput,
    hostUrl = 'http://localhost:4000'
  ) {
    const webhookSecret = input.webhookSecret || `whsec_${crypto.randomBytes(20).toString('hex')}`;

    const integration = await prisma.integration.create({
      data: {
        orgId,
        provider: input.provider,
        name: input.name,
        webhookSecret,
        apiKey: input.apiKey || null,
        externalOrg: input.externalOrg || null,
        workspaceId: input.workspaceId || null,
        config: input.config || { prSlaHours: 24, autoFollowUpOnStall: true },
      },
    });

    return {
      ...integration,
      webhookUrl: `${hostUrl}/api/v1/integrations/webhooks/${integration.provider.toLowerCase()}/${integration.id}`,
    };
  }

  /**
   * Update integration settings
   */
  public static async updateIntegration(orgId: string, id: string, input: UpdateIntegrationInput) {
    const existing = await prisma.integration.findFirst({ where: { id, orgId } });
    if (!existing) throw new Error('Integration not found');

    const updated = await prisma.integration.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        isEnabled: input.isEnabled ?? existing.isEnabled,
        webhookSecret: input.webhookSecret !== undefined ? input.webhookSecret : existing.webhookSecret,
        apiKey: input.apiKey !== undefined ? input.apiKey : existing.apiKey,
        externalOrg: input.externalOrg !== undefined ? input.externalOrg : existing.externalOrg,
        workspaceId: input.workspaceId !== undefined ? input.workspaceId : existing.workspaceId,
        config: input.config ? { ...((existing.config as any) || {}), ...input.config } : existing.config,
      },
    });

    return updated;
  }

  /**
   * Delete an integration
   */
  public static async deleteIntegration(orgId: string, id: string) {
    const existing = await prisma.integration.findFirst({ where: { id, orgId } });
    if (!existing) throw new Error('Integration not found');

    return prisma.integration.delete({ where: { id } });
  }

  /**
   * Ingest and route raw inbound webhooks (Central Event Mesh)
   */
  public static async handleInboundEvent(
    integrationId: string,
    eventType: string,
    payload: any,
    headers: any = {}
  ): Promise<{ status: string; message: string; data?: any }> {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error(`Integration ${integrationId} does not exist`);
    }

    const deliveryId =
      headers['x-github-delivery'] ||
      headers['x-gitlab-event-uuid'] ||
      headers['x-request-id'] ||
      `evt_${crypto.randomBytes(12).toString('hex')}`;

    // Verify signature for GitHub if secret is configured
    if (integration.provider === 'GITHUB' && integration.webhookSecret && headers['x-hub-signature-256']) {
      const sig = headers['x-hub-signature-256'];
      const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
      if (!GithubWatchdogService.verifySignature(rawBody, sig, integration.webhookSecret)) {
        throw new Error('Invalid HMAC-SHA256 signature on GitHub webhook');
      }
    }

    // Record Event Mesh Log
    const eventLog = await prisma.integrationEvent.create({
      data: {
        orgId: integration.orgId,
        integrationId: integration.id,
        provider: integration.provider,
        eventType,
        deliveryId,
        payload,
        status: 'RECEIVED',
      },
    });

    try {
      let result: any = null;

      switch (integration.provider) {
        case 'GITHUB':
        case 'GITLAB':
          result = await GithubWatchdogService.processWebhook(
            integration.id,
            integration.orgId,
            eventType,
            payload
          );
          break;

        case 'JIRA':
          result = await JiraLinearSyncService.processJiraWebhook(
            integration.id,
            integration.orgId,
            payload
          );
          break;

        case 'LINEAR':
          result = await JiraLinearSyncService.processLinearWebhook(
            integration.id,
            integration.orgId,
            payload
          );
          break;

        case 'SLACK':
          result = await SlackTeamsService.processSlackCommand(
            integration.id,
            integration.orgId,
            payload
          );
          break;

        case 'TEAMS':
          result = await SlackTeamsService.processTeamsMessage(
            integration.id,
            integration.orgId,
            payload
          );
          break;

        default:
          result = { handled: false, message: `Unsupported provider: ${integration.provider}` };
      }

      // Mark event processed
      await prisma.$transaction([
        prisma.integrationEvent.update({
          where: { id: eventLog.id },
          data: {
            status: result?.handled ? 'PROCESSED' : 'IGNORED',
            processedAt: new Date(),
          },
        }),
        prisma.integration.update({
          where: { id: integration.id },
          data: { lastSyncAt: new Date() },
        }),
      ]);

      return {
        status: 'SUCCESS',
        message: result?.message || 'Webhook event processed',
        data: result,
      };
    } catch (err: any) {
      console.error(`[Event Mesh Ingestion Failed] ${err.message}`, err);

      await prisma.integrationEvent.update({
        where: { id: eventLog.id },
        data: {
          status: 'FAILED',
          errorMessage: err.message || 'Unknown processing error',
          processedAt: new Date(),
        },
      });

      throw err;
    }
  }

  /**
   * PR Watchdog: List tracked pull requests with filtering
   */
  public static async listPullRequests(
    orgId: string,
    filter?: { status?: string; isStalled?: boolean; repository?: string }
  ) {
    const where: any = { orgId };

    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.isStalled !== undefined) {
      where.isStalled = filter.isStalled;
    }
    if (filter?.repository) {
      where.repository = { contains: filter.repository, mode: 'insensitive' };
    }

    return prisma.pullRequestWatch.findMany({
      where,
      orderBy: [{ isStalled: 'desc' }, { openedAt: 'desc' }],
      take: 100,
    });
  }

  /**
   * PR Watchdog: Aggregated statistics
   */
  public static async getPrWatchdogStats(orgId: string): Promise<PrWatchdogStats> {
    return GithubWatchdogService.getWatchdogStats(orgId);
  }

  /**
   * PR Watchdog: Trigger on-demand SLA scan
   */
  public static async triggerPrScan(orgId: string) {
    return GithubWatchdogService.scanStalledPrs(orgId);
  }

  /**
   * Event Mesh: List recent integration events
   */
  public static async listEvents(orgId: string, take = 50) {
    return prisma.integrationEvent.findMany({
      where: { orgId },
      include: {
        integration: {
          select: { name: true, provider: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
    });
  }
}
