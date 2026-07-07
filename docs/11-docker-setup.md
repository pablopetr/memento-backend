# 11 — Docker Setup (Build & Run)

**Estimated time:** ~20 minutes

## Description

This task consolidates and finalizes the Docker configuration touched on
throughout earlier tasks ([setup.md](./01-setup.md),
[database-schema.md](./02-database-schema.md),
[notification-integration.md](./06-notification-integration.md)) into a
single, reliable "build and run" story for the whole backend stack —
API + database + migrations.

## Files

```
backend/
├── Dockerfile
├── docker-compose.yml
├── docker-compose.override.yml   # local dev: hot reload, bind mounts
├── docker-compose.test.yml       # e2e test DB overrides
├── .dockerignore
├── .env.example
└── secrets/                      # gitignored; FCM service account, etc.
```

### `Dockerfile` (recap, see [setup.md](./01-setup.md) for full content)

Multi-stage build: `builder` stage installs all deps + compiles
TypeScript + generates the Prisma client; `production` stage installs
only prod deps and copies the compiled `dist/` + `prisma/` folder.

### `docker-compose.yml` (recap, see [setup.md](./01-setup.md))

Two services: `backend` (the NestJS API) and `db` (Postgres), with a
named volume for data persistence and a healthcheck gating startup order.

### `.dockerignore`

```
node_modules
dist
.git
.env
secrets/
*.log
```

## High-Level Plan

1. **Build the image**
   ```bash
   docker compose build
   ```
2. **First-time startup** (creates volumes, runs migrations via the
   `backend` service's `command`, starts the API):
   ```bash
   docker compose up -d
   docker compose logs -f backend
   ```
3. **Database setup / migrations** — already wired into the `backend`
   service's startup command (`prisma migrate deploy && node dist/main.js`),
   so a fresh `docker compose up` always leaves the schema up to date.
   To run migrations manually without starting the app:
   ```bash
   docker compose run --rm backend npx prisma migrate deploy
   ```
4. **Seeding demo data**
   ```bash
   docker compose run --rm backend npx prisma db seed
   ```
5. **Local development with hot reload** — `docker-compose.override.yml`
   (automatically merged by `docker compose up`) overrides the command
   and mounts the source directory:
   ```yaml
   services:
     backend:
       build:
         target: builder
       volumes:
         - ./src:/app/src
         - ./prisma:/app/prisma
       command: npm run start:dev
       environment:
         - ENABLE_SWAGGER=true
   ```
6. **Stopping / resetting**
   ```bash
   docker compose down          # stop containers, keep volumes/data
   docker compose down -v       # also wipe the Postgres volume
   ```
7. **Production-like run** (ignore the dev override):
   ```bash
   docker compose -f docker-compose.yml up -d --build
   ```
8. **Health check** — add a simple `GET /health` endpoint returning
   `{ status: 'ok' }`, and reference it from a Docker `HEALTHCHECK`
   instruction in the `Dockerfile` for orchestration platforms that rely
   on container-level health signals:
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
     CMD wget -qO- http://localhost:3000/health || exit 1
   ```

## Full local verification checklist

```bash
docker compose up -d --build
docker compose exec db pg_isready -U reminder_user
curl http://localhost:3000/health
curl http://localhost:3000/api/docs             # Swagger UI reachable
docker compose exec backend npm run test        # unit tests
docker compose run --rm backend npm run test:e2e  # e2e tests
```

## Notes

- This file is the operational entry point for anyone (or any CI
  pipeline) that needs to stand up the whole backend — link back to it
  from the project root `README.md` once one exists.
- Secrets (`JWT_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON`, DB credentials)
  always come from `.env`/mounted files, never hardcoded in
  `docker-compose.yml` or the `Dockerfile`, so the same image is safe to
  build in any environment.
