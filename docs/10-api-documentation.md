# 10 — API Documentation (Swagger / OpenAPI)

**Estimated time:** ~20 minutes

## Description

Generate interactive API documentation for every endpoint (auth,
reminders) using `@nestjs/swagger`, so frontend (React Native)
developers have an accurate, always-up-to-date reference without
hand-maintained docs.

## Dependencies / Libraries

```bash
npm install @nestjs/swagger swagger-ui-express
```

## High-Level Plan

1. **Bootstrap Swagger in `main.ts`**
   ```ts
   const config = new DocumentBuilder()
     .setTitle('Reminder App API')
     .setDescription('REST API for the Reminder mobile app backend')
     .setVersion('1.0')
     .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
     .build();

   const document = SwaggerModule.createDocument(app, config);
   SwaggerModule.setup('api/docs', app, document);
   ```
   Guard this behind an env flag if you don't want docs exposed in
   production (`if (process.env.ENABLE_SWAGGER === 'true') { ... }`).

2. **Annotate DTOs** with `@ApiProperty()` so field types/examples show
   up correctly:
   ```ts
   export class CreateReminderDto {
     @ApiProperty({ example: 'Take medicine' })
     @IsString() @IsNotEmpty()
     title: string;

     @ApiPropertyOptional({ example: 'After breakfast' })
     @IsOptional() @IsString()
     description?: string;

     @ApiProperty({ example: '2026-07-08T08:00:00.000Z' })
     @IsISO8601()
     scheduledAt: string;
   }
   ```

3. **Annotate controllers**
   ```ts
   @ApiTags('reminders')
   @ApiBearerAuth('access-token')
   @Controller('reminders')
   export class RemindersController {
     @ApiOperation({ summary: 'Create a new reminder' })
     @ApiResponse({ status: 201, description: 'Reminder created', type: ReminderResponseDto })
     @ApiResponse({ status: 400, description: 'Validation error' })
     @Post()
     create(...) { ... }
   }
   ```

4. **Response DTOs** — define `ReminderResponseDto`/`LoginResponseDto`
   classes (with `@ApiProperty()`) rather than returning raw Prisma
   models, so the documented shape can't drift from what's actually
   returned and password hashes are never accidentally exposed.

5. **Tag grouping** — use `@ApiTags('auth')` and `@ApiTags('reminders')`
   so the Swagger UI groups endpoints logically.

6. **Auth documentation** — the `addBearerAuth` config above adds an
   "Authorize" button in the Swagger UI so reviewers can paste a token
   once and exercise protected routes interactively.

## Accessing the docs within the Docker container

- Swagger UI is served by the same `backend` process — no extra
  container needed.
- Once `docker compose up` is running, open:
  ```
  http://localhost:3000/api/docs
  ```
- The raw OpenAPI JSON is available at
  `http://localhost:3000/api/docs-json`, which the React Native team
  can optionally feed into a client generator (e.g. `openapi-generator`)
  to produce typed API clients.

## Notes

- Keep annotations close to the DTOs/controllers they describe rather
  than maintaining a separate hand-written spec file — single source of
  truth, no drift (DRY).
- Re-verify the docs after any change to
  [reminder-crud.md](./04-reminder-crud.md) or
  [authentication.md](./03-authentication.md) endpoints.
