import { prisma } from '../common/prisma';
import { DoraService } from '../modules/engops/dora.service';
import { DevExService } from '../modules/engops/devex.service';
import { OkrService } from '../modules/engops/okr.service';

async function runTest() {
  console.log('🧪 Starting Engineering Operations & DORA Metrics Engine Test (Sprint 17)...\n');

  // 1. Locate organization and user
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  if (!org) throw new Error('No organization found');

  const user = await prisma.user.findFirst({
    where: {
      orgMemberships: {
        some: { orgId: org.id },
      },
    },
  });
  if (!user) throw new Error('No user found in organization');

  console.log(`[1] Context: Org "${org.name}" (${org.id}), User "${user.displayName}" (${user.id})`);

  // Cleanup existing test deployments/incidents/pulses/okrs for clean run
  await prisma.deployment.deleteMany({ where: { orgId: org.id } });
  await prisma.incident.deleteMany({ where: { orgId: org.id } });
  await prisma.devExPulse.deleteMany({ where: { orgId: org.id } });
  await prisma.objective.deleteMany({ where: { orgId: org.id } });

  // 2. Record Deployments
  console.log('\n[2] Recording CI/CD Deployments...');
  const dep1 = await DoraService.recordDeployment(org.id, {
    serviceName: 'core-api',
    version: 'v3.1.0',
    environment: 'PRODUCTION',
    status: 'SUCCESS',
    commitSha: 'a1b2c3d4e5f6',
    leadTimeMinutes: 45, // 45 min lead time
    deployedBy: user.email,
  });
  console.log('    ✅ Deployment 1 recorded:', { id: dep1.id, service: dep1.serviceName, status: dep1.status, leadTime: dep1.leadTimeMinutes });

  const dep2 = await DoraService.recordDeployment(org.id, {
    serviceName: 'core-api',
    version: 'v3.1.1',
    environment: 'PRODUCTION',
    status: 'SUCCESS',
    commitSha: 'f6e5d4c3b2a1',
    leadTimeMinutes: 30, // 30 min lead time
    deployedBy: user.email,
  });
  console.log('    ✅ Deployment 2 recorded:', { id: dep2.id, service: dep2.serviceName, status: dep2.status, leadTime: dep2.leadTimeMinutes });

  const dep3 = await DoraService.recordDeployment(org.id, {
    serviceName: 'payments-worker',
    version: 'v2.4.0',
    environment: 'PRODUCTION',
    status: 'FAILED',
    commitSha: '998877665544',
    leadTimeMinutes: 90,
    deployedBy: user.email,
  });
  console.log('    ✅ Deployment 3 recorded (Failed):', { id: dep3.id, service: dep3.serviceName, status: dep3.status });

  // 3. Record Production Incident (MTTR)
  console.log('\n[3] Recording Incident & Time to Restore Service (MTTR)...');
  const now = new Date();
  const startedAt = new Date(now.getTime() - 40 * 60 * 1000); // 40 minutes ago
  const incident = await DoraService.recordIncident(org.id, {
    title: '502 Bad Gateway during payments-worker release',
    severity: 'SEV2_HIGH',
    status: 'RESOLVED',
    serviceName: 'payments-worker',
    startedAt: startedAt.toISOString(),
    resolvedAt: now.toISOString(),
    rootCause: 'OOM error due to unindexed SQL query',
    deploymentId: dep3.id,
    isChangeFailure: true,
  });
  console.log('    ✅ Incident recorded & resolved:', {
    id: incident.id,
    title: incident.title,
    severity: incident.severity,
    recoveryTimeMinutes: incident.recoveryTimeMinutes,
  });

  // 4. Compute DORA 4 Metrics Scorecard
  console.log('\n[4] Computing DORA 4 Metrics Scorecard (DF, LTTC, CFR, MTTR)...');
  const scorecard = await DoraService.getDoraScorecard(org.id, 30);
  console.log('    📊 DORA Scorecard Result:');
  console.log(`       - Overall Tier: ${scorecard.overallTier}`);
  console.log(`       - Deployment Frequency: ${scorecard.deploymentFrequency.formattedValue} (${scorecard.deploymentFrequency.totalDeployments} total) -> Tier: ${scorecard.deploymentFrequency.tier}`);
  console.log(`       - Lead Time for Changes: ${scorecard.leadTimeForChanges.formattedValue} -> Tier: ${scorecard.leadTimeForChanges.tier}`);
  console.log(`       - Change Failure Rate: ${scorecard.changeFailureRate.formattedValue} (${scorecard.changeFailureRate.failedDeployments} failed) -> Tier: ${scorecard.changeFailureRate.tier}`);
  console.log(`       - Time to Restore Service: ${scorecard.timeToRestoreService.formattedValue} -> Tier: ${scorecard.timeToRestoreService.tier}`);

  if (scorecard.deploymentFrequency.totalDeployments !== 3) {
    throw new Error(`Expected 3 total deployments, got ${scorecard.deploymentFrequency.totalDeployments}`);
  }
  if (scorecard.changeFailureRate.failedDeployments !== 1) {
    throw new Error(`Expected 1 failed deployment, got ${scorecard.changeFailureRate.failedDeployments}`);
  }

  // 5. Submit DevEx Weekly Pulse
  console.log('\n[5] Submitting DevEx Sentiment Pulse...');
  const pulse = await DevExService.submitPulse(org.id, user.id, {
    score: 4,
    frictionArea: 'CODE_REVIEW',
    focusTimeHours: 26,
    onCallBurden: 2,
    isAnonymous: false,
    notes: 'Sprint velocity high, but CI build queue taking ~20m per commit.',
  });
  console.log('    ✅ DevEx Pulse submitted:', {
    id: pulse.id,
    score: pulse.score,
    frictionArea: pulse.frictionArea,
    focusHours: pulse.focusTimeHours,
  });

  // 6. DevEx Radar & Workload Analysis
  console.log('\n[6] Evaluating DevEx Burnout Radar & Workload Overload Risk...');
  const radar = await DevExService.getRadar(org.id, 30);
  console.log('    🧠 DevEx Radar Summary:');
  console.log(`       - Average Score: ${radar.averageScore}/5`);
  console.log(`       - Average Focus Time: ${radar.averageFocusTimeHours}h/week`);
  console.log(`       - Burnout Risk: ${radar.burnoutRisk}`);
  console.log('       - Top Friction Area:', radar.topFrictionArea);
  console.log('       - Friction Breakdown:', radar.frictionBreakdown);

  const workload = await DevExService.getWorkloadRadar(org.id);
  console.log(`    ⚠️ Workload Radar evaluated for ${workload.length} team member(s).`);

  // 7. Cascading Team OKRs
  console.log('\n[7] Testing Cascading Team OKRs Engine...');
  const quarter = '2026-Q4';
  const objective = await OkrService.createObjective(org.id, {
    title: 'Achieve Elite DORA Tier & Reduce Production Incident MTTR',
    quarter,
    level: 'ORGANIZATION',
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.000Z',
  });
  console.log('    ✅ Objective Created:', { id: objective.id, title: objective.title, level: objective.level, progressPercent: objective.progressPercent });

  // Add Key Results
  const kr1 = await OkrService.createKeyResult(objective.id, {
    title: 'Reduce MTTR to under 1.0 hour across all services',
    currentValue: 0,
    targetValue: 1,
    initialValue: 0,
    unit: 'hours',
  });
  console.log('    ✅ Key Result 1 Added:', { id: kr1.id, title: kr1.title, target: kr1.targetValue });

  const kr2 = await OkrService.createKeyResult(objective.id, {
    title: 'Increase deployment frequency to >= 5 production releases per week',
    currentValue: 0,
    targetValue: 5,
    initialValue: 0,
    unit: 'releases',
  });
  console.log('    ✅ Key Result 2 Added:', { id: kr2.id, title: kr2.title, target: kr2.targetValue });

  // Update Key Result progress and verify parent progress rollup
  console.log('\n[8] Updating Key Result progress & checking automatic Objective progress rollup...');
  const updatedKr1 = await OkrService.updateKeyResult(kr1.id, {
    currentValue: 0.5, // 50%
  });
  console.log(`    KR1 updated: current = ${updatedKr1.currentValue}/${updatedKr1.targetValue} (50% complete)`);

  const updatedObj1 = await prisma.objective.findUnique({ where: { id: objective.id } });
  console.log(`    🎯 Parent Objective Progress rolled up to: ${updatedObj1?.progressPercent}% (expected 25%)`);
  if (Math.round(updatedObj1?.progressPercent || 0) !== 25) {
    throw new Error(`Expected Objective progress 25%, got ${updatedObj1?.progressPercent}`);
  }

  const updatedKr2 = await OkrService.updateKeyResult(kr2.id, {
    currentValue: 5, // 100%
  });
  console.log(`    KR2 updated: current = ${updatedKr2.currentValue}/${updatedKr2.targetValue} (100% complete)`);

  const updatedObj2 = await prisma.objective.findUnique({ where: { id: objective.id } });
  console.log(`    🎯 Parent Objective Progress rolled up to: ${updatedObj2?.progressPercent}% (expected 75%)`);
  if (Math.round(updatedObj2?.progressPercent || 0) !== 75) {
    throw new Error(`Expected Objective progress 75%, got ${updatedObj2?.progressPercent}`);
  }

  // 9. List Cascading OKR Tree
  console.log('\n[9] Listing Cascading OKR Tree...');
  const okrs = await OkrService.listObjectives(org.id, quarter);
  console.log(`    ✅ Retrieved ${okrs.length} OKRs for ${quarter}. Key results count: ${okrs[0].keyResults.length}`);

  console.log('\n🎉 SPRINT 17 (PHASE 4) ENGOPS & DORA ENGINE TEST PASSED SUCCESSFULLY!\n');
}

runTest()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
