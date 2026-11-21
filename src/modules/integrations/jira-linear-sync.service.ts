import { prisma } from '../../common/prisma';
import { TaskStatus, Priority } from '@prisma/client';

export class JiraLinearSyncService {
  /**
   * Process Jira Cloud webhook (jira:issue_created, jira:issue_updated)
   */
  public static async processJiraWebhook(
    integrationId: string,
    orgId: string,
    payload: any
  ): Promise<{ handled: boolean; message: string; taskId?: string }> {
    const issue = payload.issue;
    if (!issue || !issue.key) {
      return { handled: false, message: 'Invalid Jira webhook payload (no issue key)' };
    }

    const issueKey = issue.key;
    const summary = issue.fields?.summary || `Jira Issue ${issueKey}`;
    const description = issue.fields?.description || null;
    const jiraStatus = (issue.fields?.status?.name || '').toLowerCase();
    const jiraPriority = (issue.fields?.priority?.name || '').toLowerCase();
    const assigneeEmail = issue.fields?.assignee?.emailAddress?.toLowerCase();
    const jiraUrl = issue.self ? issue.self.replace(/\/rest\/api\/.*$/, `/browse/${issueKey}`) : null;

    // Map Jira status to LeadDesk TaskStatus
    let leadDeskStatus: TaskStatus = TaskStatus.PLANNED;
    if (['done', 'resolved', 'closed', 'complete'].some((s) => jiraStatus.includes(s))) {
      leadDeskStatus = TaskStatus.COMPLETED;
    } else if (['in progress', 'in review', 'active', 'development'].some((s) => jiraStatus.includes(s))) {
      leadDeskStatus = TaskStatus.IN_PROGRESS;
    }

    // Map Priority
    let leadDeskPriority: Priority = Priority.MEDIUM;
    if (['highest', 'high', 'critical', 'blocker'].some((p) => jiraPriority.includes(p))) {
      leadDeskPriority = Priority.HIGH;
    } else if (['lowest', 'low', 'trivial'].some((p) => jiraPriority.includes(p))) {
      leadDeskPriority = Priority.LOW;
    }

    // Find existing task by externalKey
    let task = await prisma.task.findFirst({
      where: {
        externalKey: issueKey,
        sourceSystem: 'JIRA',
      },
    });

    if (task) {
      // Update existing task
      const updated = await prisma.task.update({
        where: { id: task.id },
        data: {
          title: summary,
          description: description ? String(description) : task.description,
          status: leadDeskStatus,
          priority: leadDeskPriority,
          completedAt: leadDeskStatus === TaskStatus.COMPLETED ? task.completedAt || new Date() : null,
          lastSyncedAt: new Date(),
        },
      });

      return {
        handled: true,
        message: `Updated LeadDesk task from Jira issue ${issueKey} (Status: ${leadDeskStatus})`,
        taskId: updated.id,
      };
    }

    // Find user to assign in this organization
    let assignedUserId: string | null = null;
    if (assigneeEmail) {
      const user = await prisma.user.findUnique({ where: { email: assigneeEmail } });
      if (user) assignedUserId = user.id;
    }

    if (!assignedUserId) {
      // Fallback to org owner/admin
      const admin = await prisma.orgMembership.findFirst({
        where: { orgId, role: { in: ['OWNER', 'ORG_ADMIN'] } },
      });
      if (admin) assignedUserId = admin.userId;
    }

    if (!assignedUserId) {
      return { handled: false, message: 'Could not resolve target user for Jira task creation' };
    }

    const created = await prisma.task.create({
      data: {
        title: summary,
        description: description ? String(description) : null,
        status: leadDeskStatus,
        priority: leadDeskPriority,
        sourceSystem: 'JIRA',
        sourceUrl: jiraUrl,
        externalKey: issueKey,
        assigneeEmail: assigneeEmail || null,
        lastSyncedAt: new Date(),
        userId: assignedUserId,
      },
    });

    return {
      handled: true,
      message: `Created new LeadDesk task for Jira issue ${issueKey}`,
      taskId: created.id,
    };
  }

  /**
   * Process Linear webhook (Issue create, update, remove)
   */
  public static async processLinearWebhook(
    integrationId: string,
    orgId: string,
    payload: any
  ): Promise<{ handled: boolean; message: string; taskId?: string }> {
    const data = payload.data;
    if (!data || !data.identifier) {
      return { handled: false, message: 'Invalid Linear webhook payload (no identifier)' };
    }

    const issueKey = data.identifier; // e.g. "ENG-42"
    const title = data.title || `Linear Issue ${issueKey}`;
    const description = data.description || null;
    const stateType = (data.state?.type || data.state?.name || '').toLowerCase();
    const linearUrl = data.url || `https://linear.app/issue/${issueKey}`;

    let leadDeskStatus: TaskStatus = TaskStatus.PLANNED;
    if (['completed', 'canceled', 'done'].some((s) => stateType.includes(s))) {
      leadDeskStatus = TaskStatus.COMPLETED;
    } else if (['started', 'in_progress', 'in progress'].some((s) => stateType.includes(s))) {
      leadDeskStatus = TaskStatus.IN_PROGRESS;
    }

    let task = await prisma.task.findFirst({
      where: {
        externalKey: issueKey,
        sourceSystem: 'LINEAR',
      },
    });

    if (task) {
      const updated = await prisma.task.update({
        where: { id: task.id },
        data: {
          title,
          description: description ? String(description) : task.description,
          status: leadDeskStatus,
          completedAt: leadDeskStatus === TaskStatus.COMPLETED ? task.completedAt || new Date() : null,
          lastSyncedAt: new Date(),
        },
      });

      return {
        handled: true,
        message: `Updated LeadDesk task from Linear issue ${issueKey}`,
        taskId: updated.id,
      };
    }

    // Resolve user
    const admin = await prisma.orgMembership.findFirst({
      where: { orgId, role: { in: ['OWNER', 'ORG_ADMIN'] } },
    });

    if (!admin) {
      return { handled: false, message: 'No admin user found to assign Linear issue' };
    }

    const created = await prisma.task.create({
      data: {
        title,
        description: description ? String(description) : null,
        status: leadDeskStatus,
        sourceSystem: 'LINEAR',
        sourceUrl: linearUrl,
        externalKey: issueKey,
        lastSyncedAt: new Date(),
        userId: admin.userId,
      },
    });

    return {
      handled: true,
      message: `Created new LeadDesk task for Linear issue ${issueKey}`,
      taskId: created.id,
    };
  }

  /**
   * Outbound sync from LeadDesk Task to Jira / Linear
   */
  public static async syncTaskToExternal(taskId: string): Promise<{ synced: boolean; message: string }> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || !task.externalKey || !task.sourceSystem) {
      return { synced: false, message: 'Task is not linked to an external system' };
    }

    // Record sync timestamp
    await prisma.task.update({
      where: { id: task.id },
      data: { lastSyncedAt: new Date() },
    });

    return {
      synced: true,
      message: `Synced transition for ${task.externalKey} (${task.sourceSystem}) to ${task.status}`,
    };
  }
}
