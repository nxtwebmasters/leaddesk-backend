import { PrismaClient, OrgRole } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function backfillTenants() {
  console.log('🔄 Checking existing users for organization backfill...');
  const users = await prisma.user.findMany({
    include: {
      orgMemberships: true,
    },
  });

  for (const user of users) {
    if (user.orgMemberships.length === 0) {
      console.log(`🏢 Creating default organization for user: ${user.email} (${user.displayName})...`);
      
      const orgSlug = `${slugify(user.displayName || 'workspace')}-${user.id.slice(0, 6)}`;
      const org = await prisma.organization.create({
        data: {
          name: `${user.displayName}'s Organization`,
          slug: orgSlug,
          domain: user.email.split('@')[1] || null,
        },
      });

      // Create default Workspace
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Core Engineering',
          slug: 'core-eng',
          description: 'Primary engineering and operations workspace',
          orgId: org.id,
        },
      });

      // Create default Squad / Team
      await prisma.team.create({
        data: {
          name: 'Platform Pod',
          description: 'Foundational platform and architecture team',
          workspaceId: workspace.id,
          leadUserId: user.id,
        },
      });

      // Assign user as OWNER
      await prisma.orgMembership.create({
        data: {
          orgId: org.id,
          userId: user.id,
          role: OrgRole.OWNER,
          title: 'Engineering Lead',
          department: 'Engineering',
        },
      });

      // Backfill user's existing tasks, meetings, and notes to this workspace
      await prisma.task.updateMany({
        where: { userId: user.id, workspaceId: null },
        data: { workspaceId: workspace.id },
      });

      await prisma.meeting.updateMany({
        where: { userId: user.id, workspaceId: null },
        data: { workspaceId: workspace.id },
      });

      await prisma.note.updateMany({
        where: { userId: user.id, workspaceId: null },
        data: { workspaceId: workspace.id },
      });

      console.log(`✅ Organization created and populated for ${user.email}: ${org.name} (${org.id})`);
    } else {
      console.log(`ℹ️ User ${user.email} already belongs to ${user.orgMemberships.length} organization(s).`);
    }
  }

  console.log('🎉 Multi-tenant backfill check complete.');
}

if (require.main === module) {
  backfillTenants()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
