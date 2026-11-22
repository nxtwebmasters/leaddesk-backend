import { prisma } from '../common/prisma';
import { VectorMemoryService } from '../modules/ai-decision/vector-memory.service';
import { DecisionRagService } from '../modules/ai-decision/decision-rag.service';
import { AgendaCopilotService } from '../modules/ai-decision/agenda-copilot.service';
import { QbrGeneratorService } from '../modules/ai-decision/qbr-generator.service';

async function runTest() {
  console.log('🧪 Starting AI Decision Intelligence 2.0 & Vector Memory Test (Sprint 19)...\n');

  // 1. Locate Organization and Users
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  if (!org) throw new Error('No organization found');

  const users = await prisma.user.findMany({
    where: {
      orgMemberships: { some: { orgId: org.id } },
    },
    take: 2,
  });
  if (users.length === 0) throw new Error('No users found in organization');

  const leadUser = users[0];
  const memberUser = users.length > 1 ? users[1] : users[0];

  console.log(`[1] Context: Org "${org.name}" (${org.id}), Lead "${leadUser.displayName}", Member "${memberUser.displayName}"`);

  // Cleanup existing semantic memories, agendas, and reviews for clean test execution
  await prisma.semanticMemory.deleteMany({ where: { orgId: org.id } });
  await prisma.oneOnOneAgenda.deleteMany({ where: { orgId: org.id } });
  await prisma.quarterlyReview.deleteMany({ where: { orgId: org.id } });

  // 2. Index Architecture Decision Records (ADRs) and Incident Knowledge into Vector Memory
  console.log('\n[2] Indexing Architecture Decisions & Knowledge into 64-D Vector Memory...');

  const adr1 = await VectorMemoryService.indexDocument(org.id, {
    entityType: 'DECISION',
    title: 'ADR-001: PostgreSQL Multi-Tenancy Partitioning Strategy',
    content: 'We chose PostgreSQL row-level isolation and orgId schema partitioning over separate tenant databases. This simplifies backup automation, avoids connection pool exhaustion, and ensures sub-millisecond cross-tenant query latency.',
    metadata: { author: leadUser.displayName, status: 'ACCEPTED' },
  });
  console.log('    ✅ Indexed:', { id: adr1.id, title: adr1.title, vectorDim: adr1.embedding.length });

  const adr2 = await VectorMemoryService.indexDocument(org.id, {
    entityType: 'DECISION',
    title: 'ADR-002: JWT Authentication Token Expiry & Silent Refresh',
    content: 'Access tokens expire in 15 minutes. Refresh tokens are stored with SHA-256 hashes in PostgreSQL and rotated on every exchange with family revocation to prevent replay attacks.',
    metadata: { author: leadUser.displayName, status: 'ACCEPTED' },
  });
  console.log('    ✅ Indexed:', { id: adr2.id, title: adr2.title, vectorDim: adr2.embedding.length });

  const inc1 = await VectorMemoryService.indexDocument(org.id, {
    entityType: 'INCIDENT',
    title: 'Incident Post-Mortem: 502 Bad Gateway during payments-worker release',
    content: 'Outage caused by unindexed SQL join during high-concurrency payment processing. Resolved in 40 minutes by deploying an asynchronous Redis buffering worker and adding compound btree indexes on payments table.',
    metadata: { service: 'payments-worker', severity: 'SEV2_HIGH' },
  });
  console.log('    ✅ Indexed:', { id: inc1.id, title: inc1.title, vectorDim: inc1.embedding.length });

  const note1 = await VectorMemoryService.indexDocument(org.id, {
    entityType: 'NOTE',
    title: 'Engineering Playbook: Deep Work Flow & Focus Wednesdays',
    content: 'All Wednesdays are designated as meeting-free focus days. Team leads must protect a minimum of 20 hours per week of uninterrupted coding time to sustain Elite DORA velocity and prevent burnout.',
    metadata: { category: 'culture' },
  });
  console.log('    ✅ Indexed:', { id: note1.id, title: note1.title, vectorDim: note1.embedding.length });

  // 3. Test Vector Semantic Cosine Search
  console.log('\n[3] Testing Vector Semantic Search (Cosine Similarity)...');
  const searchResults1 = await VectorMemoryService.search(
    org.id,
    'database multi tenancy postgresql schema architecture',
    3
  );
  console.log('    🔍 Query: "database multi tenancy postgresql schema architecture"');
  searchResults1.forEach((res, i) => {
    console.log(`       [${i + 1}] "${res.title}" -> Similarity: ${(res.similarity * 100).toFixed(1)}%`);
  });

  if (searchResults1.length === 0 || searchResults1[0].title !== adr1.title) {
    throw new Error(`Expected top result to be ADR-001, got: ${searchResults1[0]?.title}`);
  }
  console.log('    ✅ Cosine similarity ranking verified.');

  // 4. Test Architecture Decision RAG Assistant
  console.log('\n[4] Asking Architecture Decision RAG Assistant...');
  const question = 'Why did we choose PostgreSQL for multi-tenant data isolation?';
  const ragResponse = await DecisionRagService.ask(org.id, { question });

  console.log(`    ❓ Question: "${ragResponse.question}"`);
  console.log(`    💡 Answer Preview:\n${ragResponse.answer.split('\n').map((l) => '       ' + l).join('\n')}`);
  console.log('    📚 Citations Attached:', ragResponse.citations.map((c) => `[${c.sourceType}] ${c.title}`));
  console.log(`    🎯 Confidence Score: ${(ragResponse.confidenceScore * 100).toFixed(1)}%`);

  if (ragResponse.citations.length === 0) {
    throw new Error('RAG response lacked source citations!');
  }
  console.log('    ✅ Architecture Decision RAG Assistant successfully answered with citations.');

  // 5. Test 1-on-1 Agenda Copilot
  console.log('\n[5] Testing 1-on-1 Agenda Copilot for Engineering Leads...');
  // Seed a sample task for memberUser
  await prisma.task.create({
    data: {
      userId: memberUser.id,
      title: 'Migrate Redis session cache cluster to Valkey v8',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
    },
  });

  const agenda = await AgendaCopilotService.generateAgenda(org.id, leadUser.id, {
    memberId: memberUser.id,
  });

  console.log(`    ✅ 1-on-1 Agenda Generated for "${agenda.member.displayName}":`);
  const points = agenda.talkingPoints as any[];
  points.forEach((tp: any, idx: number) => {
    console.log(`       [${idx + 1}] [${tp.category}] ${tp.title}`);
    console.log(`           Reason: ${tp.reason}`);
    console.log(`           Action: ${tp.suggestedAction}`);
  });

  if (points.length < 3) {
    throw new Error(`Expected at least 3 agenda talking points, got ${points.length}`);
  }

  // 6. Test Quarterly Executive Retro & QBR Generator
  console.log('\n[6] Generating Quarterly Executive Retrospective & QBR (2026-Q4)...');
  const qbr = await QbrGeneratorService.generate(org.id, leadUser.id, {
    quarter: '2026-Q4',
  });

  console.log(`    ✅ Executive Review Created: "${qbr.title}"`);
  console.log(`    📊 DORA Summary Encapsulated: ${(qbr.doraSummary as any).overallTier} Tier`);
  console.log(`    🎯 Strategic Priorities Count: ${(qbr.strategicPriorities as any[]).length}`);
  console.log(`    📝 Executive Markdown Length: ${qbr.executiveSummary.length} chars`);
  console.log('\n--- QBR Executive Preview ---');
  console.log(qbr.executiveSummary.substring(0, 480) + '...\n-----------------------------');

  console.log('\n🎉 SPRINT 19 (PHASE 6) AI DECISION INTELLIGENCE & VECTOR MEMORY TEST PASSED SUCCESSFULLY!\n');
}

runTest()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
