import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@example.com';
  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: passwordHash,
      name: 'Demo User',
      reminders: {
        create: {
          title: 'Welcome to Memento',
          description: 'This is a seeded demo reminder.',
          scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    },
  });

  console.log(`Seeded demo user: ${user.email} (id=${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
