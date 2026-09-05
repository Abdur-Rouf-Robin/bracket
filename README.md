# Bracket

Tournament platform in the spirit of [Challonge](https://challonge.com/) and [Score7](https://www.score7.io/en): brackets, live standings, scheduling, communities, events, and embeds.

## Stack

- **Web**: Next.js 15, Tailwind v4, Radix UI, TanStack Query, Socket.IO client, next-themes, sonner
- **API**: NestJS 11, Prisma 6, PostgreSQL, Redis / BullMQ (optional), Socket.IO, Passport JWT, Swagger, Stripe (optional)
- **Packages**: `@bracket/shared` (Zod contracts), `@bracket/bracket-engine` (formats, standings, Elo, scheduler)

## Quick start

```bash
# Optional: Redis via Docker (host port 6380)
docker compose up -d redis

npm install
npm run build:packages

# Configure DB in apps/api/.env
# DATABASE_URL=postgresql://postgres:14789@localhost:5432/bracket?schema=public
# REDIS_URL=redis://localhost:6380

cp .env.example apps/web/.env.local

npm run db:migrate
npm run dev:api
npm run dev:web
```

- Web: http://localhost:3000
- API Swagger: http://localhost:3001/api/docs
- Public API docs: http://localhost:3000/api-docs

Copy `.env.example` into `apps/api/.env` as well if you are starting from scratch. Stripe keys are optional — checkout and ticket payments return `{ configured: false }` until they are set.

## Features

**Tournaments & formats**
- Single / double elimination, round robin, Swiss (classic + pots), groups + knockout, FFA, leaderboard, racing
- Seeding, byes, third-place and placement matches through 16th, consolation bracket, bracket reset, split participants into losers
- Set-based scoring, points for a win/draw/loss, custom standings criteria (H2H, Buchholz, Sonneborn-Berger, NRR, …) and manual adjustments
- Live Socket.IO updates on public `/t/[slug]`

**Registration & accounts**
- Public sign-up pages, custom fields, waiver, waitlist, approve/reject, check-in, entry fees (Stripe)
- Email verification, password reset, public profiles, inbox
- Participant self-report, match comments, attachments

**Scheduling**
- Stations, referees, auto-scheduler, drag-and-drop calendar, station queue / TV board, `.ics` feeds, courtside referee console (`/r/[token]`)

**Communities & events**
- Communities with roles, follows, announcements, Elo rankings, templates
- Multi-tournament events with tickets, door/Stripe orders, check-in, stream embeds

**Sharing & developer**
- Embeds, QR, TV mode, print/PDF/CSV, password-gated tournaments, participant access pages (`/p/[token]`)
- Clone, copy participants, reopen
- API keys, public REST `/v1`, webhooks

**Plans**
- Standard (free) vs Premier (Stripe). Participant caps are enforced in `setTeams`. Ads slot is opt-in via `NEXT_PUBLIC_ADS_ENABLED`.

## Smoke test

With the API running:

```bash
API_URL=http://localhost:3001 npm run smoke
```

Engine tests: `npm run test -w @bracket/bracket-engine`  
Typecheck: `npm run lint`

## Out of scope (later)

Expo / React Native, full i18n, persisted inbox notification preferences.
