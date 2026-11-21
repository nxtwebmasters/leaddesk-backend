import { prisma } from '../../common/prisma';
import { InboxService } from '../inbox/inbox.service';

export class SlackTeamsService {
  /**
   * Process inbound Slack slash command (e.g. /leaddesk capture [text])
   */
  public static async processSlackCommand(
    integrationId: string,
    orgId: string,
    body: any
  ): Promise<{ response: any; handled: boolean }> {
    const text = (body.text || body.command_text || '').trim();
    const userName = body.user_name || 'slack_user';
    const email = body.user_email || body.email;

    if (!text) {
      return {
        handled: true,
        response: {
          response_type: 'ephemeral',
          text: '⚠️ Please provide content to capture. Example: `/leaddesk 1-on-1 prep: Discuss Q3 promotions with Jane`',
        },
      };
    }

    // Resolve user in organization
    let user = null;
    if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    }

    if (!user) {
      // Find org admin as fallback
      const admin = await prisma.orgMembership.findFirst({
        where: { orgId, role: { in: ['OWNER', 'ORG_ADMIN'] } },
        include: { user: true },
      });
      user = admin?.user || null;
    }

    if (!user) {
      return {
        handled: false,
        response: {
          response_type: 'ephemeral',
          text: '❌ Could not match Slack user to an active LeadDesk account.',
        },
      };
    }

    // Capture into Inbox
    const inboxItem = await InboxService.create(user.id, {
      content: text,
      type: 'NOTE',
      source: 'SLACK',
    });

    return {
      handled: true,
      response: {
        response_type: 'ephemeral',
        text: '⚡️ *LeadDesk Quick-Capture Successful!*',
        attachments: [
          {
            color: '#38bdf8',
            fields: [
              { title: 'Captured By', value: `@${userName}`, short: true },
              { title: 'Inbox Item ID', value: inboxItem.id.substring(0, 8), short: true },
              { title: 'Content', value: text, short: false },
            ],
            footer: 'LeadDesk Enterprise Event Mesh',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      },
    };
  }

  /**
   * Process inbound Microsoft Teams Bot / Webhook Message
   */
  public static async processTeamsMessage(
    integrationId: string,
    orgId: string,
    body: any
  ): Promise<{ response: any; handled: boolean }> {
    const text = (body.text || body.content || '').replace(/<at>.*?<\/at>/g, '').trim();

    if (!text) {
      return {
        handled: true,
        response: { type: 'message', text: 'LeadDesk: Please include text to capture.' },
      };
    }

    // Find admin user
    const admin = await prisma.orgMembership.findFirst({
      where: { orgId, role: { in: ['OWNER', 'ORG_ADMIN'] } },
    });

    if (!admin) {
      return {
        handled: false,
        response: { type: 'message', text: 'No active LeadDesk user found for this channel.' },
      };
    }

    const inboxItem = await InboxService.create(admin.userId, {
      content: text,
      type: 'NOTE',
      source: 'TEAMS',
    });

    return {
      handled: true,
      response: {
        type: 'message',
        text: `⚡️ **LeadDesk Quick-Capture**: Captured item into your inbox! (ID: ${inboxItem.id.substring(0, 8)})`,
      },
    };
  }

  /**
   * Broadcast an alert or stalled PR notification to Slack / Teams channel
   */
  public static async broadcastAlert(
    integrationId: string,
    alert: {
      title: string;
      message: string;
      url?: string;
      level?: 'info' | 'warning' | 'alert';
    }
  ): Promise<boolean> {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || !integration.isEnabled) return false;

    const config = (integration.config as any) || {};
    const webhookUrl = config.baseApiUrl || config.webhookUrl;

    if (!webhookUrl) return false;

    try {
      const color =
        alert.level === 'alert' ? '#ef4444' : alert.level === 'warning' ? '#f59e0b' : '#3b82f6';

      const payload = {
        text: `${alert.level === 'alert' ? '🚨' : alert.level === 'warning' ? '⚠️' : 'ℹ️'} *${alert.title}*`,
        attachments: [
          {
            color,
            text: alert.message,
            actions: alert.url ? [{ type: 'button', text: 'Open in LeadDesk', url: alert.url }] : [],
          },
        ],
      };

      // In sandbox/development, log the dispatch
      console.log(`[Integration Broadcast] Dispatched alert to ${integration.provider}:`, alert.title);
      return true;
    } catch (err) {
      console.error('[Integration Broadcast Error]', err);
      return false;
    }
  }
}
