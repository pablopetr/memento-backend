# 03 — JWT Authentication (Login Only)

**Estimated time:** ~20 minutes

## Description

Implement login-only authentication: a single `POST /auth/login` endpoint
that validates credentials against the `User` table and returns a signed
JWT. Protect all reminder routes with a guard that validates the token.
No registration endpoint — users are expected to be seeded/provisioned
directly in the database (see [database-schema.md](./02-database-schema.md)).

## Dependencies / Libraries

- `@nestjs/jwt`
- `@nestjs/passport`, `passport`, `passport-jwt`
- `bcrypt` (password hashing/verification)
- `class-validator`, `class-transformer` (DTO validation)

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer
npm install -D @types/passport-jwt @types/bcrypt
```

## High-Level Plan

1. **`AuthModule`** — imports `PassportModule`, `JwtModule.registerAsync`
   pulling `JWT_SECRET`/`JWT_EXPIRES_IN` from `ConfigService`.

2. **DTO** — `LoginDto`:
   ```ts
   export class LoginDto {
     @IsEmail() email: string;
     @IsString() @MinLength(6) password: string;
   }
   ```

3. **`AuthService`**
   ```ts
   async validateUser(email: string, password: string): Promise<User> {
     const user = await this.prisma.user.findUnique({ where: { email } });
     if (!user || !(await bcrypt.compare(password, user.password))) {
       throw new UnauthorizedException('Invalid credentials');
     }
     return user;
   }

   async login(user: User) {
     const payload = { sub: user.id, email: user.email };
     return { accessToken: this.jwtService.sign(payload) };
   }
   ```

4. **`AuthController`**
   ```ts
   @Post('login')
   @HttpCode(200)
   async login(@Body() dto: LoginDto) {
     const user = await this.authService.validateUser(dto.email, dto.password);
     return this.authService.login(user);
   }
   ```

5. **`JwtStrategy`** (extends `PassportStrategy(Strategy)`) — extracts the
   bearer token, verifies signature/expiry, and returns `{ userId, email }`
   attached to `request.user`.

6. **`JwtAuthGuard`** (extends `AuthGuard('jwt')`) — apply globally via
   `APP_GUARD` with a `@Public()` decorator to exempt `/auth/login`,
   rather than annotating every protected controller individually (DRY):
   ```ts
   @Public()
   @Post('login')
   ```
   ```ts
   { provide: APP_GUARD, useClass: JwtAuthGuard }
   ```

7. **Response/error shape** — reuse the global exception filter from
   [error-handling.md](./09-error-handling.md) so 401s follow the same
   `{ statusCode, message, error }` contract as every other error.

## Auth flow in the containerized environment

- `JWT_SECRET` and `JWT_EXPIRES_IN` are injected via the `.env` file
  referenced in `docker-compose.yml`'s `env_file` — never bake secrets
  into the image itself.
- Because the backend and Postgres both run as Compose services, no
  extra network configuration is needed; `AuthService` reaches the DB
  through the same `PrismaService` used elsewhere.
- To test login manually against the running container:
  ```bash
  docker compose up -d
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"demo@example.com","password":"password123"}'
  ```
- For local secret rotation, update `.env` and run
  `docker compose up -d --force-recreate backend` to pick up the new value.

## Notes

- Passwords are only ever compared via `bcrypt.compare`; the hash is
  seeded once (see seed script in [database-schema.md](./02-database-schema.md)).
- Keep `JwtStrategy` and `JwtAuthGuard` as the single source of truth for
  token validation so every protected module (reminders, etc.) relies on
  the same guard (SOLID — single responsibility, no duplicated logic).
