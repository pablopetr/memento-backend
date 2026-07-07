# 08 — End-to-End Tests (Supertest)

**Estimated time:** ~20 minutes

## Description

Write end-to-end tests that exercise the real HTTP layer (via
Supertest) against a running NestJS app and a real (test) database,
covering the full request lifecycle: auth, reminder CRUD, and error
responses.

## Dependencies / Libraries

- `supertest` (typically already present via `nest new`'s default
  `test/app.e2e-spec.ts`)
- A dedicated **test database** (separate Postgres instance/DB from
  dev) to avoid clobbering local data

```bash
npm install -D supertest
```

## Test Scenarios

### Auth
- `POST /auth/login` with valid seeded credentials → `200` + `accessToken`.
- `POST /auth/login` with wrong password → `401`.
- `POST /auth/login` with a malformed body (missing `email`) → `400`
  with validation error details.

### Reminders (as an authenticated user)
- `POST /reminders` with valid payload → `201`, response matches shape.
- `POST /reminders` with `scheduledAt` in the past → `400`.
- `GET /reminders` → `200`, only returns reminders owned by the
  authenticated user (seed a second user + reminder to prove isolation).
- `GET /reminders/:id` for another user's reminder → `404` (not `403` —
  avoid leaking existence).
- `PATCH /reminders/:id` updates fields and returns the updated entity.
- `DELETE /reminders/:id` → `204`, subsequent `GET` → `404`.
- Any reminders route without an `Authorization` header → `401`.

## Setup / Teardown

1. **Isolated test DB** — add a `docker-compose.test.yml` (or reuse the
   main compose file with a different `DATABASE_URL`/port) pointing at a
   separate database, e.g. `reminder_db_test`.
2. **Global setup** (`test/jest-e2e.json` → `globalSetup`):
   - Run `prisma migrate deploy` against the test DB.
   - Run the seed script to create one known test user.
3. **Per-suite `beforeAll`**:
   ```ts
   beforeAll(async () => {
     const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
     app = moduleFixture.createNestApplication();
     app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
     await app.init();
   });

   afterAll(async () => {
     await app.close();
   });
   ```
4. **Per-test isolation** — wrap each test's mutations in cleanup
   (`afterEach`, delete created reminders) or truncate the `reminders`
   table between test files, so tests don't leak state into each other
   (avoid relying on ordering).
5. **Auth helper** — a shared `loginAsTestUser(app)` helper that logs in
   once and returns the token, reused across all e2e spec files (DRY,
   avoids repeating the login boilerplate in every test).

## Running e2e tests inside the Docker container

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d db
docker compose run --rm \
  -e DATABASE_URL="postgresql://reminder_user:reminder_pass@db:5432/reminder_db_test?schema=public" \
  backend npm run test:e2e
```

Alternatively, add a dedicated `test:e2e` npm script that itself invokes
`prisma migrate deploy` against the test DB before `jest --config test/jest-e2e.json`,
so a single command handles setup:

```json
"test:e2e": "prisma migrate deploy && jest --config ./test/jest-e2e.json"
```

## Notes

- Keep e2e tests focused on **contract-level behavior** (status codes,
  response shapes, auth/ownership boundaries) — deep business-logic
  edge cases belong in unit tests
  ([unit-tests.md](./07-unit-tests.md)).
- Do not mock Prisma or the database here — the point of e2e tests is to
  catch issues that only show up with real DB constraints/migrations.
