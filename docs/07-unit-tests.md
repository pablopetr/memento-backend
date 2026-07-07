# 07 — Unit Tests (Jest)

**Estimated time:** ~20 minutes

## Description

Write focused unit tests for the service-layer logic implemented across
prior tasks — auth, reminders CRUD, and the scheduler — using Jest with
mocked dependencies (no real database or network calls).

## Dependencies / Libraries

- `jest`, `ts-jest` (included by default in a `nest new` project)
- `@nestjs/testing` (`Test.createTestingModule`)
- Manual mocks for `PrismaService`, `JwtService`, `NotificationsService`

## Test Plan

### `AuthService`
- `validateUser` returns the user when email/password match.
- `validateUser` throws `UnauthorizedException` when the user doesn't
  exist.
- `validateUser` throws `UnauthorizedException` when the password
  doesn't match (mock `bcrypt.compare` to return `false`).
- `login` returns an object containing a signed `accessToken`
  (mock `JwtService.sign`).

### `RemindersService`
- `create` calls `prisma.reminder.create` with the correct `userId`
  injected from the caller, not from the DTO.
- `create` rejects a `scheduledAt` in the past with
  `BadRequestException`.
- `findAll` scopes the query to the current `userId`.
- `findOne` throws `NotFoundException` when no reminder matches
  `{ id, userId }`.
- `update`/`remove` throw `NotFoundException` for reminders owned by a
  different user (ownership check, most important case to cover).

### `ReminderSchedulerService`
- `handleDueReminders` fetches only `PENDING` reminders with
  `scheduledAt <= now` (assert the `where` clause passed to the mocked
  `prisma.reminder.findMany`).
- On success, calls `notifications.sendReminderNotification` and then
  updates the reminder to `TRIGGERED`.
- On a thrown error from `notifications.sendReminderNotification`, the
  reminder is **not** marked `TRIGGERED` (left for retry).

### `NotificationsService`
- `sendReminderNotification` is a no-op (returns early, no FCM call)
  when the user has no registered device tokens.
- Calls `admin.messaging().sendEachForMulticast` with all of the user's
  tokens when present (mock the `firebase-admin` module).

## Mocking conventions (keep consistent, avoid duplication)

- Centralize a `createMockPrismaService()` factory in
  `test/mocks/prisma.mock.ts` returning a Jest-mocked object shaped like
  `PrismaService`, reused across all service specs (DRY).
- Use `Test.createTestingModule({ providers: [...] }).overrideProvider(PrismaService).useValue(mockPrisma)` 
  rather than instantiating services with `new` — keeps DI wiring
  consistent with how Nest actually constructs them.
- Mock `firebase-admin` at the module level with
  `jest.mock('firebase-admin')` in the notifications spec.

## Running unit tests inside the Docker container

```bash
docker compose exec backend npm run test
# with coverage
docker compose exec backend npm run test:cov
```

If the container isn't already running:
```bash
docker compose run --rm backend npm run test
```

For local development, add a `test` stage to the `Dockerfile` (or reuse
the `builder` stage, which still has `devDependencies`) so
`docker compose run --rm builder npm test` works without needing a full
production build.

## Notes

- Unit tests never touch the real `db` service or Firebase — that's the
  job of the e2e suite in [e2e-tests.md](./08-e2e-tests.md).
- Target meaningful coverage of business logic (ownership checks,
  status transitions, error paths) over raw percentage numbers.
