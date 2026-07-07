# 01 — Project Setup (NestJS + Prisma + Docker)

**Estimated time:** ~20 minutes

## Description

Bootstrap a new NestJS backend project, wire up Prisma ORM as the database
layer, and establish the base Docker configuration that every later task
will build on. By the end of this task you should be able to run
`docker compose up` and have a NestJS app connected to a Postgres database
inside a container.

## Dependencies / Libraries

- Node.js 20 LTS
- `@nestjs/cli`
- `@nestjs/config` (env var loading)
- `prisma` / `@prisma/client`
- Docker Desktop / Docker Engine + Docker Compose v2
- PostgreSQL (official `postgres:16-alpine` image)

## High-Level Plan

1. **Scaffold the NestJS app**
   ```bash
   npm i -g @nestjs/cli
   nest new backend --package-manager npm
   cd backend
   ```
2. **Install Prisma**
   ```bash
   npm install prisma --save-dev
   npm install @prisma/client
   npx prisma init
   ```
   This creates `prisma/schema.prisma` and a `.env` file with
   `DATABASE_URL`.
3. **Configure environment variables**
   - Create `.env` and `.env.example` with:
     ```
     DATABASE_URL="postgresql://reminder_user:reminder_pass@db:5432/reminder_db?schema=public"
     JWT_SECRET="change-me"
     JWT_EXPIRES_IN="1d"
     PORT=3000
     ```
   - Add `@nestjs/config` and load it globally in `AppModule` via
     `ConfigModule.forRoot({ isGlobal: true })`.
4. **Create the `Dockerfile` (multi-stage build)**
   ```dockerfile
   # ---- deps & build ----
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npx prisma generate
   RUN npm run build

   # ---- production ----
   FROM node:20-alpine AS production
   WORKDIR /app
   ENV NODE_ENV=production
   COPY package*.json ./
   RUN npm ci --omit=dev
   COPY --from=builder /app/dist ./dist
   COPY --from=builder /app/prisma ./prisma
   RUN npx prisma generate
   EXPOSE 3000
   CMD ["node", "dist/main.js"]
   ```
5. **Create `docker-compose.yml`**
   ```yaml
   services:
     backend:
       build: .
       ports:
         - "3000:3000"
       env_file: .env
       depends_on:
         db:
           condition: service_healthy
       command: sh -c "npx prisma migrate deploy && node dist/main.js"

     db:
       image: postgres:16-alpine
       restart: unless-stopped
       environment:
         POSTGRES_USER: reminder_user
         POSTGRES_PASSWORD: reminder_pass
         POSTGRES_DB: reminder_db
       ports:
         - "5432:5432"
       volumes:
         - db_data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U reminder_user -d reminder_db"]
         interval: 5s
         timeout: 5s
         retries: 5

   volumes:
     db_data:
   ```
6. **Add a `docker-compose.override.yml` for local development** with
   hot-reload (`npm run start:dev`) and a bind-mounted volume, so the
   production `docker-compose.yml` stays clean and deployable as-is.
7. **Verify**
   ```bash
   docker compose up --build
   curl http://localhost:3000
   ```

## Notes

- Keep `Dockerfile` production-focused; use the override file (or a
  separate `Dockerfile.dev`) for the dev inner-loop with live reload.
- `.dockerignore` should exclude `node_modules`, `dist`, `.git`, `.env`.
- This task only sets up the skeleton — schema design is covered in
  [database-schema.md](./02-database-schema.md).
