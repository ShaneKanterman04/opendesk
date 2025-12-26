import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const email = process.env.ADMIN_EMAIL || 'admin@opendesk.local';
  const password = process.env.ADMIN_PASSWORD || 'Adm1n!2025-opendesk';

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { password: hashed, isAdmin: true },
    create: { email, password: hashed, isAdmin: true },
  });

  console.log(`Default admin ensured: ${email}`);
  console.log(`Password (dev only): ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
