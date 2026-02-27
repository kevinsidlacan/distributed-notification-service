import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@notifq.dev';
  const password = 'admin123';

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`✅ Admin "${email}" already exists. Skipping seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.create({
    data: { email, passwordHash },
  });

  console.log(`🌱 Seeded default admin: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
