# Bracket

Tournament bracket platform — web MVP (no mobile app in this phase).

## Stack

- **Web**: Next.js, Tailwind, Radix-style UI, TanStack Query, Socket.IO client
- **API**: NestJS, Prisma, PostgreSQL, Redis, BullMQ, Socket.IO, Passport JWT, Swagger
- **Packages**: `@bracket/shared`, `@bracket/bracket-engine`

## Quick start

```bash
# Optional: Redis via Docker (host port 6380)
docker compose up -d redis

npm install
npm run build:packages

# Configure DB in apps/api/.env (example uses local Postgres)
# DATABASE_URL=postgresql://postgres:14789@localhost:5432/bracket?schema=public
# REDIS_URL=redis://localhost:6380

cp .env.example apps/web/.env.local

npm run db:migrate
npm run dev:api
npm run dev:web
```

- Web: http://localhost:3000
- API docs: http://localhost:3001/api/docs

## Features

- Auth (register / login / me)
- Tournament wizard: name, public/private, teams, optional groups
- Formats: round robin, single elim, double elim, groups + knockout
- Groups → knockout auto-seeds when group stage completes
- Match scores, optional %, winner picker, clear / force overwrite
- Live standings + Socket.IO updates on public `/t/[slug]`
- Dashboard: open by slug, delete, manage, share link
- Mark completed / reset bracket
- BullMQ webhook stub (`WEBHOOK_URL`) + sync standings fallback

## Smoke test

With API running:

```bash
npm run smoke
```

## Out of scope (later)

Expo / React Native, PM2, Nginx production deploy.
