# 04 — Reminder CRUD Endpoints

**Estimated time:** ~20 minutes

## Description

Implement create/read/update/delete endpoints for reminders, scoped to
the authenticated user (from the JWT payload set up in
[authentication.md](./03-authentication.md)). All routes require a valid
JWT and only operate on reminders owned by the requesting user.

## Dependencies / Libraries

- `class-validator`, `class-transformer` (already installed)
- `PrismaService` (from [database-schema.md](./02-database-schema.md))

## Endpoints

| Method | Path             | Description                          |
|--------|------------------|---------------------------------------|
| POST   | `/reminders`     | Create a reminder                    |
| GET    | `/reminders`     | List current user's reminders        |
| GET    | `/reminders/:id` | Get a single reminder                |
| PATCH  | `/reminders/:id` | Update a reminder                    |
| DELETE | `/reminders/:id` | Delete a reminder                    |

## DTOs

```ts
export class CreateReminderDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  title: string;

  @IsString() @IsOptional() @MaxLength(1000)
  description?: string;

  @IsISO8601()
  scheduledAt: string; // validated as a future date in the service layer
}

export class UpdateReminderDto extends PartialType(CreateReminderDto) {}
```

Request/response examples:

```jsonc
// POST /reminders  (request)
{
  "title": "Take medicine",
  "description": "After breakfast",
  "scheduledAt": "2026-07-08T08:00:00.000Z"
}

// 201 response
{
  "id": "a1b2c3d4-...",
  "title": "Take medicine",
  "description": "After breakfast",
  "scheduledAt": "2026-07-08T08:00:00.000Z",
  "status": "PENDING",
  "userId": "u1u2u3u4-...",
  "createdAt": "2026-07-07T12:00:00.000Z",
  "updatedAt": "2026-07-07T12:00:00.000Z"
}
```

## High-Level Plan

1. **`RemindersModule`** with `RemindersController` and `RemindersService`.
2. **Ownership enforcement** — every service method filters by
   `{ id, userId }` (never `{ id }` alone) so users cannot access or
   mutate reminders belonging to others:
   ```ts
   async findOne(id: string, userId: string) {
     const reminder = await this.prisma.reminder.findFirst({ where: { id, userId } });
     if (!reminder) throw new NotFoundException('Reminder not found');
     return reminder;
   }
   ```
3. **Controller** pulls `userId` from `@CurrentUser()` (a custom param
   decorator reading `request.user`), never from the request body — a
   single decorator implementation shared across all routes (DRY):
   ```ts
   @Post()
   create(@Body() dto: CreateReminderDto, @CurrentUser() userId: string) {
     return this.remindersService.create(dto, userId);
   }
   ```
4. **Validation** — enable a global `ValidationPipe` in `main.ts`
   (`whitelist: true, forbidNonWhitelisted: true, transform: true`) once,
   rather than per-controller.
5. **Business-rule validation** — reject `scheduledAt` values in the past
   with a `BadRequestException`, checked in the service layer (keeps
   controllers thin — single responsibility).
6. **Pagination (optional, keep simple)** — accept `?take=&skip=` query
   params on `GET /reminders` with sane defaults (e.g. `take=20`).

## Testing endpoints inside the Docker container

```bash
docker compose up -d
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"password123"}' | jq -r .accessToken)

curl -X POST http://localhost:3000/reminders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Test reminder","scheduledAt":"2026-07-08T08:00:00.000Z"}'

curl http://localhost:3000/reminders -H "Authorization: Bearer $TOKEN"
```

For repeatable checks, prefer the Supertest suite in
[e2e-tests.md](./08-e2e-tests.md) run via `docker compose exec backend npm run test:e2e`.

## Notes

- Keep `RemindersService` free of scheduling/notification logic — that
  belongs in [reminder-scheduling.md](./05-reminder-scheduling.md) and
  [notification-integration.md](./06-notification-integration.md)
  respectively (single responsibility).
