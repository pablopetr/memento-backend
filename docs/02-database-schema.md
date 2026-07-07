# 02 — Database Schema (Prisma)

**Estimated time:** ~20 minutes

## Description

Define the Prisma schema for `User` and `Reminder` models, establish the
relationship between them, and run the initial migration inside the
Docker container so the database state matches the schema.

## Dependencies / Libraries

- `prisma` (already installed in [setup.md](./01-setup.md))
- Running Postgres container from `docker-compose.yml`

## Schema

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String     @id @default(uuid())
  email     String     @unique
  password  String     // bcrypt hash, never store plaintext
  name      String?
  reminders Reminder[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@map("users")
}

enum ReminderStatus {
  PENDING
  TRIGGERED
  CANCELLED
}

model Reminder {
  id          String         @id @default(uuid())
  title       String
  description String?
  scheduledAt DateTime
  status      ReminderStatus @default(PENDING)
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([userId])
  @@index([scheduledAt, status])
  @@map("reminders")
}
```

### Design notes

- `onDelete: Cascade` keeps orphaned reminders from lingering when a user
  is removed — simple and avoids extra cleanup logic (KISS).
- The composite index on `(scheduledAt, status)` supports the scheduler's
  polling query (`WHERE status = 'PENDING' AND scheduledAt <= now()`),
  covered in [reminder-scheduling.md](./05-reminder-scheduling.md).
- No `Registration`/sign-up fields (e.g. `emailVerified`) since
  registration is out of scope — see [authentication.md](./03-authentication.md).

## High-Level Plan

1. Write/update `prisma/schema.prisma` as above.
2. Generate the initial migration **locally against the containerized DB**:
   ```bash
   docker compose up -d db
   npx prisma migrate dev --name init
   ```
   This creates `prisma/migrations/<timestamp>_init/migration.sql` and
   applies it to the `db` service.
3. Regenerate the Prisma Client:
   ```bash
   npx prisma generate
   ```
4. Create a shared `PrismaService` (extends `PrismaClient`) and a
   `PrismaModule` (marked `@Global()`) so it can be injected anywhere
   without repeated imports (DRY):
   ```ts
   @Injectable()
   export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
     async onModuleInit() { await this.$connect(); }
     async onModuleDestroy() { await this.$disconnect(); }
   }
   ```
5. **Running migrations in the container** (production flow, already
   wired into `docker-compose.yml`'s `command`):
   ```bash
   docker compose run --rm backend npx prisma migrate deploy
   ```
   or simply restart the stack, since the `backend` service command runs
   `prisma migrate deploy` before starting the app.
6. Seed data (optional, useful for manual testing):
   - Add `prisma/seed.ts` creating one demo user with a bcrypt-hashed
     password.
   - Register it in `package.json`:
     ```json
     "prisma": { "seed": "ts-node prisma/seed.ts" }
     ```
   - Run with `docker compose run --rm backend npx prisma db seed`.

## Verification

```bash
docker compose exec db psql -U reminder_user -d reminder_db -c "\dt"
```
Confirm `users` and `reminders` tables exist with expected columns.
