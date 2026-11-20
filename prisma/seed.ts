import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.INITIAL_OWNER_EMAIL || 'lead@example.com';
  const password = process.env.INITIAL_OWNER_PASSWORD || 'ChangeMeImmediately123!';
  const displayName = process.env.INITIAL_OWNER_NAME || 'Team Lead';
  const timezone = process.env.INITIAL_OWNER_TIMEZONE || 'Asia/Karachi';

  console.log(`🌱 Seeding initial owner: ${email}...`);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  if (existingUser) {
    console.log(`ℹ️  Owner ${email} already exists. Updating credentials...`);
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        displayName,
        timezone,
      },
    });
  } else {
    console.log(`✨ Creating initial owner account...`);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        timezone,
      },
    });
  }

  console.log(`✅ Seed completed successfully for owner: ${email}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
