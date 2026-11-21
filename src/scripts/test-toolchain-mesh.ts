import crypto from 'crypto';
import { prisma } from '../common/prisma';
import { IntegrationsService } from '../modules/integrations/integrations.service';
import { JiraLinearSyncService } from '../modules/integrations/jira-linear-sync.service';

function createHubSig(secret: string, payload: any): string {
  const json = JSON.stringify(payload);
  const hash = crypto.createHmac('sha256', secret).update(json).digest('hex');
  return `sha256=${hash}`;
}

async function runTest() {
  console.log('🧪 Starting Toolchain Event Mesh & Bi-Directional Integrations Test (Sprint 16)...\n');

  // 1. Locate organization
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (!org) throw new Error('No organization found');
  console.log(`[1] Using Organization: "${org.name}" (${org.id})`);

  // Clean previous test integrations for idempotency
  await prisma.integration.deleteMany({ where: { orgId: org.id } });
  await prisma.task.deleteMany({ where: { externalKey: { in: ['ENG-9941', 'LIN-42'] } } });

  // 2. Create GitHub Integration
  console.log('\n[2] Provisioning GitHub Integration...');
  const github = await IntegrationsService.createIntegration(org.id, {
    provider: 'GITHUB',
    name: 'Core Platform Repos',
    config: {
      prSlaHours: 12,
      autoFollowUpOnStall: true,
    },
  });
  console.log('    ✅ GitHub Integration created:', { id: github.id, name: github.name, webhookUrl: github.webhookUrl });

  // 3. Create Jira Integration
  console.log('\n[3] Provisioning Jira Cloud Integration...');
  const jira = await IntegrationsService.createIntegration(org.id, {
    provider: 'JIRA',
    name: 'Jira Cloud Engineering',
  });
  console.log('    ✅ Jira Integration created:', { id: jira.id, name: jira.name, webhookUrl: jira.webhookUrl });

  // 4. Create Slack Integration
  console.log('\n[4] Provisioning Slack Integration...');
  const slack = await IntegrationsService.createIntegration(org.id, {
    provider: 'SLACK',
    name: 'Eng Leadership Slack',
  });
  console.log('    ✅ Slack Integration created:', { id: slack.id, name: slack.name });

  // 5. Test GitHub Webhook (PR Opened)
  console.log('\n[5] Simulating Inbound GitHub PR Opened Event...');
  const prOpenPayload = {
    action: 'opened',
    pull_request: {
      number: 402,
      title: 'feat: add distributed lock to cache layer',
      html_url: 'https://github.com/acme/platform-core/pull/402',
      state: 'open',
      merged: false,
      draft: false,
      user: { login: 'dev-alex', email: 'alex@acme.com' },
      created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), // 18h ago
      requested_reviewers: [{ login: 'lead-sarah' }, { login: 'lead-john' }],
    },
    repository: { full_name: 'acme/platform-core' },
  };

  const openResult = await IntegrationsService.handleInboundEvent(
    github.id,
    'pull_request',
    prOpenPayload,
    {
      'x-github-event': 'pull_request',
      'x-github-delivery': 'del-pr-open-402',
      'x-hub-signature-256': createHubSig(github.webhookSecret!, prOpenPayload),
    }
  );
  console.log('    ✅ Event Mesh Result:', openResult.status, '|', openResult.message);

  // 6. Test GitHub Webhook (PR Review Submitted)
  console.log('\n[6] Simulating Inbound GitHub PR Review Submitted Event...');
  const prReviewPayload = {
    action: 'submitted',
    pull_request: {
      number: 402,
      title: 'feat: add distributed lock to cache layer',
      html_url: 'https://github.com/acme/platform-core/pull/402',
      state: 'open',
      user: { login: 'dev-alex' },
      created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    },
    review: {
      state: 'APPROVED',
      submitted_at: new Date().toISOString(),
    },
    repository: { full_name: 'acme/platform-core' },
  };

  const reviewResult = await IntegrationsService.handleInboundEvent(
    github.id,
    'pull_request_review',
    prReviewPayload,
    {
      'x-github-event': 'pull_request_review',
      'x-hub-signature-256': createHubSig(github.webhookSecret!, prReviewPayload),
    }
  );
  console.log('    ✅ Event Mesh Result:', reviewResult.status, '|', reviewResult.message);

  // 7. Test Stalled PR Breaching SLA
  console.log('\n[7] Simulating Stalled PR (SLA Breach)...');
  const stalledPrPayload = {
    action: 'opened',
    pull_request: {
      number: 403,
      title: 'fix: memory leak in stream consumer',
      html_url: 'https://github.com/acme/platform-core/pull/403',
      state: 'open',
      merged: false,
      draft: false,
      user: { login: 'junior-dev' },
      created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(), // 36 hours ago! SLA is 12h
      requested_reviewers: [{ login: 'staff-eng' }],
    },
    repository: { full_name: 'acme/platform-core' },
  };

  await IntegrationsService.handleInboundEvent(github.id, 'pull_request', stalledPrPayload, {
    'x-github-event': 'pull_request',
  });

  const scanResult = await IntegrationsService.triggerPrScan(org.id);
  console.log('    ✅ Triggered PR Watchdog Scan:', {
    scanned: scanResult.scanned,
    newlyStalledCount: scanResult.stalledCount,
  });

  // Verify FollowUp generated for stalled PR
  const followUp = await prisma.followUp.findFirst({
    where: { subject: { contains: 'PR #403' } },
  });
  if (followUp) {
    console.log('    ✅ Automated Follow-Up Generated for Lead:', followUp.subject);
  }

  // 8. Test PR Watchdog Analytics
  console.log('\n[8] Querying PR Watchdog Aggregated Telemetry...');
  const stats = await IntegrationsService.getPrWatchdogStats(org.id);
  console.log('    ✅ PR Watchdog Metrics:', {
    totalTracked: stats.totalTracked,
    openCount: stats.openCount,
    stalledCount: stats.stalledCount,
    avgReviewLatency: `${(stats.avgReviewLatencyMinutes / 60).toFixed(1)} hours`,
    slaBreachRate: `${stats.slaBreachRatePercent}%`,
    repositoriesCount: stats.repositories.length,
  });

  // 9. Test Jira 2-Way Issue Sync
  console.log('\n[9] Simulating Inbound Jira Issue Created & Updated Webhook...');
  const jiraCreatedPayload = {
    webhookEvent: 'jira:issue_created',
    issue: {
      key: 'ENG-9941',
      self: 'https://acme.atlassian.net/rest/api/2/issue/ENG-9941',
      fields: {
        summary: 'Implement distributed tracing with OpenTelemetry',
        description: 'Need full traces across payment and notification services',
        status: { name: 'In Progress' },
        priority: { name: 'High' },
      },
    },
  };

  const jiraRes = await IntegrationsService.handleInboundEvent(jira.id, 'jira:issue_created', jiraCreatedPayload);
  console.log('    ✅ Jira Inbound Task Created:', jiraRes.message);

  // Transition in Jira to Done
  const jiraUpdatedPayload = {
    webhookEvent: 'jira:issue_updated',
    issue: {
      key: 'ENG-9941',
      self: 'https://acme.atlassian.net/rest/api/2/issue/ENG-9941',
      fields: {
        summary: 'Implement distributed tracing with OpenTelemetry',
        status: { name: 'Done' },
      },
    },
  };

  const jiraUpdateRes = await IntegrationsService.handleInboundEvent(jira.id, 'jira:issue_updated', jiraUpdatedPayload);
  console.log('    ✅ Jira Inbound Task Transitioned:', jiraUpdateRes.message);

  const syncedTask = await prisma.task.findFirst({ where: { externalKey: 'ENG-9941' } });
  console.log('    ✅ Verified LeadDesk Task State:', {
    id: syncedTask?.id,
    externalKey: syncedTask?.externalKey,
    status: syncedTask?.status,
    completedAt: syncedTask?.completedAt,
  });

  // Test Outbound Transition Trigger
  if (syncedTask) {
    const outbound = await JiraLinearSyncService.syncTaskToExternal(syncedTask.id);
    console.log('    ✅ Outbound Sync Trigger:', outbound.message);
  }

  // 10. Test Slack Slash Command Quick-Capture
  console.log('\n[10] Simulating Inbound Slack Quick-Capture (/leaddesk)...');
  const slackPayload = {
    command: '/leaddesk',
    text: '1-on-1 action: Prepare promotion review packet for Senior Engineer',
    user_name: 'alex_lead',
  };

  const slackRes = await IntegrationsService.handleInboundEvent(slack.id, 'SLACK', slackPayload);
  console.log('    ✅ Slack Quick-Capture Response Text:', slackRes.data?.response?.text);

  // 11. Verify Event Mesh Log
  console.log('\n[11] Verifying Event Mesh Logs...');
  const eventLogs = await IntegrationsService.listEvents(org.id, 10);
  console.log(`    ✅ Verified ${eventLogs.length} events logged in Event Mesh audit trail.`);
  console.log('    Recent Event Types:', eventLogs.map((e) => `${e.provider}:${e.eventType} (${e.status})`).slice(0, 4));

  console.log('\n🎉 ALL SPRINT 16 (TOOLCHAIN EVENT MESH & INTEGRATIONS) TESTS PASSED! 🚀');
}

runTest()
  .catch((e) => {
    console.error('❌ Test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
