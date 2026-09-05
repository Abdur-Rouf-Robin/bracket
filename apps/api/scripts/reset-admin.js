const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function main() {
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (password.length < 8 || password === 'password123') {
    console.error(
      'Set ADMIN_PASSWORD to a strong password (min 8 characters, not password123).',
    );
    process.exit(1);
  }
  const p = new PrismaClient();
  const hash = await bcrypt.hash(password, 10);
  for (const email of ['admin@example.com', 'admin@bracket.local']) {
    const u = await p.user.upsert({
      where: { email },
      create: {
        email,
        name: 'Admin',
        passwordHash: hash,
        role: 'ADMIN',
        emailVerified: true,
      },
      update: { passwordHash: hash, role: 'ADMIN', emailVerified: true },
    });
    console.log('ok', u.email);
  }
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
