const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function main() {
  const p = new PrismaClient();
  const hash = await bcrypt.hash('password123', 10);
  for (const email of ['admin@example.com', 'admin@bracket.local']) {
    const u = await p.user.upsert({
      where: { email },
      create: { email, name: 'Admin', passwordHash: hash },
      update: { passwordHash: hash },
    });
    console.log('ok', u.email);
  }
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
