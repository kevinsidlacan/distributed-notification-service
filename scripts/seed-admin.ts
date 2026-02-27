/**
 * seed-admin.ts
 *
 * Bootstraps the first admin account for the notification service.
 * This is the ONLY way to create admin accounts — there is no public registration endpoint.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword npm run seed:admin
 *
 * Or set ADMIN_EMAIL and ADMIN_PASSWORD in your .env and run:
 *   npm run seed:admin
 */

import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in your environment or .env file.');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('❌ Error: ADMIN_PASSWORD must be at least 6 characters.');
    process.exit(1);
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`⚠️  Admin with email "${email}" already exists. No changes made.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.create({
    data: { email, passwordHash },
  });

  console.log(`✅ Admin account created successfully.`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   ID:    ${admin.id}`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
