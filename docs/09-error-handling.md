# 09 — Error Handling & Validation

**Estimated time:** ~20 minutes

## Description

Establish a single, consistent error-response contract across the whole
API: a global exception filter, a global validation pipe, and
predictable JSON error shapes for both expected failures (validation,
not found, unauthorized) and unexpected ones (uncaught exceptions).

## Dependencies / Libraries

- Built into NestJS: `ExceptionFilter`, `ArgumentsHost`, `HttpException`
- `class-validator` (already installed for DTOs)

## Response Shape

Standardize every error response to:

```jsonc
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    { "field": "scheduledAt", "constraint": "scheduledAt must be a valid ISO 8601 date string" }
  ],
  "path": "/reminders",
  "timestamp": "2026-07-07T12:00:00.000Z"
}
```

For non-validation errors, `details` is omitted and `message` carries
the human-readable reason (e.g. `"Reminder not found"`).

## High-Level Plan

1. **Global exception filter** — a single `AllExceptionsFilter`
   (`@Catch()`, no argument) handling *every* thrown error in one place
   rather than scattering try/catch blocks through controllers (DRY,
   single responsibility):
   ```ts
   @Catch()
   export class AllExceptionsFilter implements ExceptionFilter {
     catch(exception: unknown, host: ArgumentsHost) {
       const ctx = host.switchToHttp();
       const response = ctx.getResponse<Response>();
       const request = ctx.getRequest<Request>();

       const status = exception instanceof HttpException
         ? exception.getStatus()
         : HttpStatus.INTERNAL_SERVER_ERROR;

       const body = exception instanceof HttpException
         ? exception.getResponse()
         : { message: 'Internal server error' };

       response.status(status).json({
         statusCode: status,
         error: HttpStatus[status] ?? 'Error',
         ...(typeof body === 'string' ? { message: body } : body),
         path: request.url,
         timestamp: new Date().toISOString(),
       });
     }
   }
   ```
   Register globally in `main.ts`: `app.useGlobalFilters(new AllExceptionsFilter())`.

2. **Global validation pipe** — configure once in `main.ts`:
   ```ts
   app.useGlobalPipes(new ValidationPipe({
     whitelist: true,
     forbidNonWhitelisted: true,
     transform: true,
     exceptionFactory: (errors) => new BadRequestException({
       message: 'Validation failed',
       details: errors.map((e) => ({
         field: e.property,
         constraint: Object.values(e.constraints ?? {}).join(', '),
       })),
     }),
   }));
   ```

3. **Domain-specific exceptions** — reuse Nest's built-ins consistently
   rather than inventing custom classes for simple cases:
   - `NotFoundException` — reminder/user not found
   - `UnauthorizedException` — bad credentials / missing-invalid token
   - `BadRequestException` — invalid input (past `scheduledAt`, etc.)
   - `ForbiddenException` — reserved for future role-based cases (not
     needed yet since ownership checks return 404, per
     [reminder-crud.md](./04-reminder-crud.md))

4. **Logging** — log 5xx errors (stack trace) inside the filter via
   Nest's built-in `Logger`; keep 4xx errors out of error-level logs to
   avoid noise from expected client mistakes.

5. **Never leak internals** — for non-`HttpException` errors, always
   return the generic `"Internal server error"` message to the client
   while logging the real error server-side.

## Testing error handling in the containerized environment

```bash
docker compose up -d
# validation error
curl -i -X POST http://localhost:3000/reminders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":""}'
# not found
curl -i http://localhost:3000/reminders/does-not-exist -H "Authorization: Bearer $TOKEN"
# unauthorized
curl -i http://localhost:3000/reminders
```
Confirm each returns the standardized JSON shape with the correct
status code. Add matching assertions to the e2e suite
([e2e-tests.md](./08-e2e-tests.md)) so this contract is regression-tested.

## Notes

- Because the filter and pipe are registered once in `main.ts`, no
  individual controller needs its own error handling — keeps controllers
  thin and consistent (DRY, KISS).
