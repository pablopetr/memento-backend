# 05 — Reminder Scheduling

**Estimated time:** ~20 minutes

## Description

Implement the mechanism that detects when a reminder's `scheduledAt`
time has arrived and marks it ready to notify. This task covers the
*scheduling/triggering* logic only; actually pushing a notification to
the frontend is handled in
[notification-integration.md](./06-notification-integration.md).

## Dependencies / Libraries

- `@nestjs/schedule` (wraps `cron`/`node-cron` for NestJS's `Cron`/`Interval` decorators)

```bash
npm install @nestjs/schedule
```

## Design

Rather than scheduling one timer per reminder (which doesn't survive a
container restart and doesn't scale), use a **polling approach**: a
recurring job checks for due reminders on a fixed interval. This is
simpler (KISS) and naturally resilient to restarts since state lives in
Postgres, not in memory.

```ts
@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleDueReminders() {
    const due = await this.prisma.reminder.findMany({
      where: { status: 'PENDING', scheduledAt: { lte: new Date() } },
      take: 50, // batch size, avoid unbounded loads
    });

    for (const reminder of due) {
      try {
        await this.notifications.sendReminderNotification(reminder);
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'TRIGGERED' },
        });
      } catch (err) {
        this.logger.error(`Failed to trigger reminder ${reminder.id}`, err);
        // left as PENDING — will be retried on the next tick
      }
    }
  }
}
```

## High-Level Plan

1. Import `ScheduleModule.forRoot()` once in `AppModule`.
2. Add the composite index `@@index([scheduledAt, status])` on
   `Reminder` (already defined in
   [database-schema.md](./02-database-schema.md)) so the polling query
   stays fast as the table grows.
3. Implement `ReminderSchedulerService` as shown above inside a new
   `SchedulingModule`, depending on `NotificationsModule` (see next doc)
   and `PrismaModule`.
4. Pick a polling interval that balances timeliness vs. DB load — 10s is
   a reasonable default for a reminder app (not a real-time system).
5. Mark triggered reminders `TRIGGERED` so they're never re-sent; a
   failed notification attempt keeps the reminder `PENDING` so the next
   tick retries it (simple at-least-once semantics).
6. **Single-instance caveat**: if the backend is ever scaled to multiple
   replicas, the naive polling loop would fire duplicate notifications.
   Document this as a known limitation for now (KISS — don't build
   distributed-lock infra prematurely); if needed later, add a
   `SELECT ... FOR UPDATE SKIP LOCKED` claim step or a dedicated
   scheduler leader election.

## Running correctly inside the container

- `@nestjs/schedule`'s cron jobs start automatically with the Nest
  application — no separate process or extra container needed; the
  `backend` service in `docker-compose.yml` runs the scheduler in the
  same process as the API.
- Ensure the container's clock is UTC (default in `node:20-alpine`) and
  that `scheduledAt` values are always stored/compared in UTC to avoid
  timezone drift between the mobile client and server.
- To verify locally:
  ```bash
  docker compose up -d
  # create a reminder scheduled ~15s in the future, then tail logs:
  docker compose logs -f backend
  ```
  You should see the reminder flip to `TRIGGERED` within one polling
  interval.

## Notes

- Keep `ReminderSchedulerService` free of HTTP/controller concerns — it
  is a pure background worker, injected with `NotificationsService` as
  an abstraction it depends on, not the concrete FCM client (dependency
  inversion, per SOLID).
