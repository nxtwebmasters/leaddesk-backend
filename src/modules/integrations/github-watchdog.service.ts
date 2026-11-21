import crypto from 'crypto';
import { prisma } from '../../common/prisma';
import { PrWatchdogStats } from './integrations.types';

export class GithubWatchdogService {
  /**
   * Verify HMAC-SHA256 signature for GitHub / GitLab webhooks
   */
  public static verifySignature(
    rawPayload: string | Buffer,
    signatureHeader: string | undefined,
    secret: string | null
  ): boolean {
    if (!secret) return true; // Secret optional if not configured
    if (!signatureHeader) return false;

    try {
      const parts = signatureHeader.split('=');
      const sigHash = parts.length === 2 ? parts[1] : signatureHeader;
      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawPayload)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(sigHash, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Process inbound GitHub / GitLab webhook
   */
  public static async processWebhook(
    integrationId: string,
    orgId: string,
    eventType: string,
    payload: any
  ): Promise<{ handled: boolean; message: string; prRecord?: any }> {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || !integration.isEnabled) {
      return { handled: false, message: 'Integration not found or disabled' };
    }

    const config = (integration.config as any) || {};
    const slaHours = config.prSlaHours || 24;

    // 1. GitHub Pull Request Event
    if (eventType === 'pull_request') {
      const pr = payload.pull_request;
      const action = payload.action;
      const repo = payload.repository?.full_name || 'unknown-repo';
      const prNumber = pr.number;
      const author = pr.user?.login || 'unknown';
      const reviewers = Array.isArray(pr.requested_reviewers)
        ? pr.requested_reviewers.map((r: any) => r.login)
        : [];

      let status: 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT' = 'OPEN';
      if (pr.merged) {
        status = 'MERGED';
      } else if (pr.state === 'closed') {
        status = 'CLOSED';
      } else if (pr.draft) {
        status = 'DRAFT';
      }

      const openedAt = new Date(pr.created_at || Date.now());
      const closedAt = pr.closed_at ? new Date(pr.closed_at) : null;
      const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;

      const record = await prisma.pullRequestWatch.upsert({
        where: {
          integrationId_repository_prNumber: {
            integrationId,
            repository: repo,
            prNumber,
          },
        },
        create: {
          integrationId,
          orgId,
          provider: 'GITHUB',
          repository: repo,
          prNumber,
          title: pr.title,
          prUrl: pr.html_url,
          authorUsername: author,
          authorEmail: pr.user?.email || null,
          status,
          requestedReviewers: reviewers,
          openedAt,
          closedAt,
          mergedAt,
          isStalled: false,
          lastActivityAt: new Date(),
        },
        update: {
          title: pr.title,
          prUrl: pr.html_url,
          status,
          requestedReviewers: reviewers,
          closedAt,
          mergedAt,
          isStalled: status === 'OPEN' ? undefined : false,
          lastActivityAt: new Date(),
        },
      });

      return {
        handled: true,
        message: `GitHub PR #${prNumber} [${action}] recorded with status ${status}`,
        prRecord: record,
      };
    }

    // 2. GitHub Pull Request Review Event
    if (eventType === 'pull_request_review') {
      const pr = payload.pull_request;
      const review = payload.review;
      const repo = payload.repository?.full_name || 'unknown-repo';
      const prNumber = pr.number;
      const reviewState = review.state; // 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED'
      const reviewSubmittedAt = new Date(review.submitted_at || Date.now());

      let watchRecord = await prisma.pullRequestWatch.findUnique({
        where: {
          integrationId_repository_prNumber: {
            integrationId,
            repository: repo,
            prNumber,
          },
        },
      });

      if (!watchRecord) {
        // Create if missing
        watchRecord = await prisma.pullRequestWatch.create({
          data: {
            integrationId,
            orgId,
            provider: 'GITHUB',
            repository: repo,
            prNumber,
            title: pr.title,
            prUrl: pr.html_url,
            authorUsername: pr.user?.login || 'unknown',
            status: pr.state === 'closed' ? 'CLOSED' : 'OPEN',
            openedAt: new Date(pr.created_at || Date.now()),
            lastActivityAt: new Date(),
          },
        });
      }

      const firstReviewAt = watchRecord.firstReviewAt || reviewSubmittedAt;
      const latencyMinutes = Math.max(
        0,
        Math.round((reviewSubmittedAt.getTime() - watchRecord.openedAt.getTime()) / (1000 * 60))
      );

      const updated = await prisma.pullRequestWatch.update({
        where: { id: watchRecord.id },
        data: {
          reviewState,
          firstReviewAt,
          reviewLatencyMinutes: watchRecord.reviewLatencyMinutes ?? latencyMinutes,
          isStalled: false,
          lastActivityAt: reviewSubmittedAt,
        },
      });

      return {
        handled: true,
        message: `GitHub PR #${prNumber} review [${reviewState}] recorded. Latency: ${latencyMinutes}m`,
        prRecord: updated,
      };
    }

    // 3. GitLab Merge Request Event
    if (eventType === 'Merge Request Hook' || payload.object_kind === 'merge_request') {
      const mr = payload.object_attributes;
      const repo = payload.project?.path_with_namespace || 'unknown-gitlab-repo';
      const prNumber = mr.iid;

      let status: 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT' = 'OPEN';
      if (mr.state === 'merged') status = 'MERGED';
      else if (mr.state === 'closed') status = 'CLOSED';
      else if (mr.work_in_progress) status = 'DRAFT';

      const openedAt = new Date(mr.created_at || Date.now());
      const closedAt = mr.state === 'closed' || mr.state === 'merged' ? new Date(mr.updated_at) : null;

      const record = await prisma.pullRequestWatch.upsert({
        where: {
          integrationId_repository_prNumber: {
            integrationId,
            repository: repo,
            prNumber,
          },
        },
        create: {
          integrationId,
          orgId,
          provider: 'GITLAB',
          repository: repo,
          prNumber,
          title: mr.title,
          prUrl: mr.url,
          authorUsername: payload.user?.username || 'gitlab-user',
          status,
          openedAt,
          closedAt,
          mergedAt: mr.state === 'merged' ? closedAt : null,
          lastActivityAt: new Date(),
        },
        update: {
          title: mr.title,
          status,
          closedAt,
          mergedAt: mr.state === 'merged' ? closedAt : null,
          isStalled: status === 'OPEN' ? undefined : false,
          lastActivityAt: new Date(),
        },
      });

      return {
        handled: true,
        message: `GitLab MR !${prNumber} recorded with status ${status}`,
        prRecord: record,
      };
    }

    return { handled: false, message: `Ignored event: ${eventType}` };
  }

  /**
   * Periodic SLA Scanner: Identifies stalled PRs and generates alerts / follow-ups
   */
  public static async scanStalledPrs(orgId: string): Promise<{
    scanned: number;
    stalledCount: number;
    newlyStalled: any[];
  }> {
    const integrations = await prisma.integration.findMany({
      where: { orgId, isEnabled: true, provider: { in: ['GITHUB', 'GITLAB'] } },
    });

    const newlyStalled: any[] = [];
    let totalScanned = 0;

    for (const integration of integrations) {
      const config = (integration.config as any) || {};
      const slaHours = config.prSlaHours || 24;
      const slaThreshold = new Date(Date.now() - slaHours * 60 * 60 * 1000);

      // Find open PRs older than SLA threshold with no review
      const candidatePrs = await prisma.pullRequestWatch.findMany({
        where: {
          integrationId: integration.id,
          status: 'OPEN',
          firstReviewAt: null,
          openedAt: { lt: slaThreshold },
        },
      });

      totalScanned += candidatePrs.length;

      for (const pr of candidatePrs) {
        if (!pr.isStalled) {
          const updated = await prisma.pullRequestWatch.update({
            where: { id: pr.id },
            data: {
              isStalled: true,
              slaBreachedAt: pr.slaBreachedAt || new Date(),
            },
          });
          newlyStalled.push(updated);

          // Automated FollowUp / Alert generation
          if (config.autoFollowUpOnStall !== false) {
            // Find organization owner or lead to assign follow-up
            const adminMembership = await prisma.orgMembership.findFirst({
              where: { orgId, role: { in: ['OWNER', 'ORG_ADMIN', 'MANAGER'] } },
            });

            if (adminMembership) {
              const overdueHours = Math.round((Date.now() - pr.openedAt.getTime()) / (1000 * 60 * 60));
              await prisma.followUp.create({
                data: {
                  contactName: `@${pr.authorUsername}`,
                  subject: `Review Bottleneck: PR #${pr.prNumber} in ${pr.repository} (${overdueHours}h overdue)`,
                  context: `Pull Request "${pr.title}" has breached the ${slaHours}-hour review SLA.\nPR URL: ${pr.prUrl}\nAuthor: @${pr.authorUsername}\nRequested Reviewers: ${pr.requestedReviewers.join(', ') || 'None assigned'}`,
                  status: 'OPEN',
                  nextFollowUpAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // Next 8h
                  userId: adminMembership.userId,
                },
              });
            }
          }
        }
      }
    }

    return {
      scanned: totalScanned,
      stalledCount: newlyStalled.length,
      newlyStalled,
    };
  }

  /**
   * Fetch PR Watchdog analytics and latency metrics
   */
  public static async getWatchdogStats(orgId: string): Promise<PrWatchdogStats> {
    const prs = await prisma.pullRequestWatch.findMany({
      where: { orgId },
      orderBy: { openedAt: 'desc' },
      take: 200,
    });

    const totalTracked = prs.length;
    const openCount = prs.filter((p) => p.status === 'OPEN').length;
    const stalledCount = prs.filter((p) => p.isStalled && p.status === 'OPEN').length;
    const mergedCount = prs.filter((p) => p.status === 'MERGED').length;

    const latencyValues = prs
      .filter((p) => p.reviewLatencyMinutes !== null && p.reviewLatencyMinutes !== undefined)
      .map((p) => p.reviewLatencyMinutes!);

    const avgReviewLatencyMinutes =
      latencyValues.length > 0
        ? Math.round(latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length)
        : 0;

    const breachedCount = prs.filter((p) => p.slaBreachedAt !== null).length;
    const slaBreachRatePercent =
      totalTracked > 0 ? Math.round((breachedCount / totalTracked) * 100) : 0;

    // Per repository breakdown
    const repoMap = new Map<
      string,
      { open: number; stalled: number; latencies: number[] }
    >();

    for (const pr of prs) {
      if (!repoMap.has(pr.repository)) {
        repoMap.set(pr.repository, { open: 0, stalled: 0, latencies: [] });
      }
      const entry = repoMap.get(pr.repository)!;
      if (pr.status === 'OPEN') entry.open++;
      if (pr.isStalled && pr.status === 'OPEN') entry.stalled++;
      if (pr.reviewLatencyMinutes) entry.latencies.push(pr.reviewLatencyMinutes);
    }

    const repositories = Array.from(repoMap.entries()).map(([repository, data]) => ({
      repository,
      openPrs: data.open,
      stalledPrs: data.stalled,
      avgLatencyMinutes:
        data.latencies.length > 0
          ? Math.round(data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length)
          : 0,
    }));

    return {
      totalTracked,
      openCount,
      stalledCount,
      mergedCount,
      avgReviewLatencyMinutes,
      slaBreachRatePercent,
      repositories,
    };
  }
}
