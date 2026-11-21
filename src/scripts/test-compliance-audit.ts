import { prisma } from '../common/prisma';
import { AuditService } from '../modules/compliance/audit.service';
import { RetentionService } from '../modules/compliance/retention.service';
import { ComplianceService } from '../modules/compliance/compliance.service';

async function runTest() {
  console.log('🧪 Starting Enterprise Security, Tamper-Evident Audit Logs & Compliance Test (Sprint 18)...\n');

  // 1. Locate organization and active user
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  if (!org) throw new Error('No organization found');

  const user = await prisma.user.findFirst({
    where: {
      orgMemberships: { some: { orgId: org.id } },
    },
  });
  if (!user) throw new Error('No user found in organization');

  console.log(`[1] Context: Org "${org.name}" (${org.id}), User "${user.displayName}" (${user.id})`);

  // Cleanup existing audit logs and exports for clean test execution
  await prisma.auditLog.deleteMany({ where: { orgId: org.id } });
  await prisma.retentionPolicy.deleteMany({ where: { orgId: org.id } });
  await prisma.complianceExport.deleteMany({ where: { orgId: org.id } });

  // 2. Build Merkle Cryptographic Audit Chain
  console.log('\n[2] Logging Events into Tamper-Evident SHA-256 Merkle Chain...');

  const log1 = await AuditService.log({
    orgId: org.id,
    userId: user.id,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user.id,
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    payload: { method: 'PASSWORD', mfaVerified: true },
  });
  console.log('    ✅ Block 1 Appended:', {
    id: log1.id,
    action: log1.action,
    prevHash: log1.prevHash.substring(0, 16) + '...',
    hash: log1.hash.substring(0, 16) + '...',
  });

  const log2 = await AuditService.log({
    orgId: org.id,
    userId: user.id,
    action: 'ROLE_CHANGE',
    entityType: 'OrgMembership',
    entityId: user.id,
    ipAddress: '192.168.1.101',
    payload: { previousRole: 'MEMBER', newRole: 'ADMIN', reason: 'Promotion to Squad Lead' },
  });
  console.log('    ✅ Block 2 Appended:', {
    id: log2.id,
    action: log2.action,
    prevHash: log2.prevHash.substring(0, 16) + '...',
    hash: log2.hash.substring(0, 16) + '...',
  });

  const log3 = await AuditService.log({
    orgId: org.id,
    userId: user.id,
    action: 'ORGANIZATION_UPDATE',
    entityType: 'Organization',
    entityId: org.id,
    ipAddress: '192.168.1.101',
    payload: { allowedDomains: ['enterprise-pilot.com', 'acme-corp.com'] },
  });
  console.log('    ✅ Block 3 Appended:', {
    id: log3.id,
    action: log3.action,
    prevHash: log3.prevHash.substring(0, 16) + '...',
    hash: log3.hash.substring(0, 16) + '...',
  });

  // Verify prevHash chaining
  if (log2.prevHash !== log1.hash) {
    throw new Error(`Block 2 prevHash does not match Block 1 hash`);
  }
  if (log3.prevHash !== log2.hash) {
    throw new Error(`Block 3 prevHash does not match Block 2 hash`);
  }
  console.log('    ⛓️ Chaining confirmed: Each block encapsulates the exact SHA-256 digest of the previous block.');

  // 3. Verify Chain Cryptographic Integrity
  console.log('\n[3] Running Cryptographic Integrity Audit...');
  const verify1 = await AuditService.verifyIntegrity(org.id);
  console.log('    🛡️ Verification Result:', verify1);
  if (!verify1.isValid || verify1.checkedRecords !== 3) {
    throw new Error(`Expected valid chain with 3 records, got: ${JSON.stringify(verify1)}`);
  }
  console.log('    ✅ Chain 100% Cryptographically Sound - Zero Tampering Detected.');

  // 4. Simulate Database Tampering & Prove Detection
  console.log('\n[4] Simulating Database Record Tampering (Malicious Attack Scenario)...');
  await prisma.auditLog.update({
    where: { id: log2.id },
    data: {
      payload: { previousRole: 'MEMBER', newRole: 'OWNER', reason: 'Unauthorized privilege escalation' },
    },
  });
  console.log(`    ⚠️ Maliciously modified payload of Block 2 (${log2.id}) directly in database.`);

  const verifyTampered = await AuditService.verifyIntegrity(org.id);
  console.log('    🚨 Tampering Detection Result:', verifyTampered);
  if (verifyTampered.isValid) {
    throw new Error('Audit verification failed to catch malicious tampering!');
  }
  console.log(`    ✅ Tampering detected immediately at Record ID ${verifyTampered.breachedRecordId}`);

  // Restore original payload to restore chain integrity
  await prisma.auditLog.update({
    where: { id: log2.id },
    data: {
      payload: { previousRole: 'MEMBER', newRole: 'ADMIN', reason: 'Promotion to Squad Lead' },
    },
  });
  const verifyRestored = await AuditService.verifyIntegrity(org.id);
  if (!verifyRestored.isValid) throw new Error('Failed to restore chain integrity');
  console.log('    ✅ Chain integrity successfully restored.');

  // 5. Retention Policies & Legal Hold Guard
  console.log('\n[5] Testing Data Retention Engine & Legal Hold Guard...');
  const defaultPolicies = await RetentionService.listPolicies(org.id);
  console.log(`    ✅ Default Retention Policies active: ${defaultPolicies.length} policy templates.`);

  // Apply Legal Hold on Integration Events
  console.log('    🛡️ Applying Legal Hold on INTEGRATION_EVENTS...');
  const heldPolicy = await RetentionService.toggleLegalHold(org.id, {
    entityType: 'INTEGRATION_EVENTS',
    legalHold: true,
    reason: 'Pending SEC / SOC-2 regulatory audit',
  });
  console.log('    ✅ Legal Hold state:', { entityType: heldPolicy.entityType, legalHold: heldPolicy.legalHold });

  // Create an expired integration event
  const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000); // 120 days ago
  await prisma.integrationEvent.create({
    data: {
      orgId: org.id,
      provider: 'GITHUB',
      eventType: 'pull_request.closed',
      deliveryId: 'test-expired-delivery-123',
      status: 'PROCESSED',
      payload: { action: 'closed', pr: 123 },
      createdAt: oldDate,
    },
  });

  // Attempt purge while Legal Hold is active -> MUST BE BLOCKED
  console.log('    Attempting purge while Legal Hold is active...');
  const purgeBlocked = await RetentionService.runPurge(org.id, user.id);
  const eventsPurgedWhileHeld = purgeBlocked.find((p) => p.entityType === 'INTEGRATION_EVENTS');
  if (eventsPurgedWhileHeld && eventsPurgedWhileHeld.purgedCount > 0) {
    throw new Error('Purge executed on an entity under Legal Hold!');
  }
  console.log('    ✅ Legal Hold successfully blocked purge of expired integration events.');

  // Release Legal Hold and re-run purge
  console.log('    Releasing Legal Hold and running compliance purge...');
  await RetentionService.toggleLegalHold(org.id, {
    entityType: 'INTEGRATION_EVENTS',
    legalHold: false,
    reason: 'Audit concluded',
  });
  const purgeAllowed = await RetentionService.runPurge(org.id, user.id);
  const purgedEvents = purgeAllowed.find((p) => p.entityType === 'INTEGRATION_EVENTS');
  console.log('    ✅ Purge executed successfully after release:', purgedEvents);

  // 6. GDPR Data Portability & Legal Discovery Export
  console.log('\n[6] Testing GDPR Data Portability Takeout Export...');
  const exportResult = await ComplianceService.requestExport(org.id, user.id, {
    type: 'GDPR_TAKEOUT',
    targetUserId: user.id,
  });
  console.log('    ✅ GDPR Takeout Bundle generated:', {
    id: exportResult.id,
    type: exportResult.type,
    recordCount: exportResult.recordCount,
    fileSizeBytes: exportResult.fileSizeBytes,
    downloadUrl: exportResult.downloadUrl,
  });

  // 7. GDPR Article 17 "Right to Erasure"
  console.log('\n[7] Testing GDPR Article 17 Right-to-be-Forgotten...');
  // Create ephemeral user to be erased
  const ephemeralUser = await prisma.user.create({
    data: {
      email: 'departed.engineer@acme-corp.com',
      displayName: 'Departed Employee',
      passwordHash: 'dummy_hash_for_test',
      orgMemberships: {
        create: {
          orgId: org.id,
          role: 'MEMBER',
        },
      },
    },
  });
  console.log(`    Created ephemeral user: "${ephemeralUser.displayName}" (${ephemeralUser.email})`);

  // Execute erasure
  const forgetResult = await ComplianceService.executeGdprForget(org.id, user.id, {
    targetUserId: ephemeralUser.id,
    confirmEmail: ephemeralUser.email,
    reason: 'Formal employee GDPR erasure request',
  });
  console.log('    ✅ Erasure Result:', forgetResult);

  const erasedUser = await prisma.user.findUnique({ where: { id: ephemeralUser.id } });
  console.log('    🔍 Anonymized User Record in DB:', {
    id: erasedUser?.id,
    displayName: erasedUser?.displayName,
    email: erasedUser?.email,
    isActive: erasedUser?.isActive,
    passwordHash: erasedUser?.passwordHash,
  });

  if (erasedUser?.email === 'departed.engineer@acme-corp.com' || erasedUser?.isActive !== false) {
    throw new Error('GDPR Erasure did not properly anonymize user record');
  }

  // 8. Verify Audit Chain Post-Erasure
  console.log('\n[8] Verifying Audit Chain Cryptographic Integrity after all Operations...');
  const finalVerify = await AuditService.verifyIntegrity(org.id);
  console.log(`    🛡️ Final Merkle Chain Verification: ${finalVerify.checkedRecords} blocks checked. Valid: ${finalVerify.isValid}`);
  if (!finalVerify.isValid) {
    throw new Error(`Final audit verification failed: ${finalVerify.error}`);
  }

  console.log('\n🎉 SPRINT 18 (PHASE 5) ENTERPRISE SECURITY & COMPLIANCE TEST PASSED SUCCESSFULLY!\n');
}

runTest()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
