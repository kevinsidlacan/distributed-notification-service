# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (requires Docker for infra)
docker compose up -d postgres redis   # Start infra only
npm run dev                            # API server (ts-node + nodemon)
npm run dev:worker                     # Worker process (ts-node + nodemon)

# Build & production
npm run build                          # Compile TypeScript to dist/
npm run start                          # Run compiled API
npm run start:worker                   # Run compiled worker

# Database
npm run db:migrate                     # Run Prisma migrations (dev)
npm run db:studio                      # Open Prisma Studio
npm run seed:admin                     # Seed the admin user

# Tests (all test files live in src/**/*.test.ts)
npm test                               # Run all tests
npx jest src/routes/campaigns.test.ts  # Run a single test file

# Full Docker stack
docker compose up -d --build           # Build and start everything
docker compose up -d --scale worker=5  # Scale workers horizontally
docker compose exec api npx prisma migrate deploy  # Run migrations in container
```

### Environment Setup

Copy `.env.example` to `.env` and provide at minimum: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. The Docker Compose stack enforces all required env vars before booting.

## Architecture

### Services (three separate processes)

- **API** (`src/index.ts`): Express 5 HTTP server. Handles campaign creation and status reads. On `POST /campaigns`, it batch-inserts messages to PostgreSQL (chunks of 1,000) and enqueues jobs via BullMQ `addBulk`. Returns `HTTP 202` immediately.
- **Worker** (`src/worker.ts`): Separate Node.js process that consumes BullMQ jobs from Redis. Calls the email service, updates message/campaign status in PostgreSQL. Rate-limited to 10 jobs/sec per worker instance. Handles `SIGTERM`/`SIGINT` for graceful shutdown.
- **Client** (`client/`): React (Vite) SPA served by Nginx. Stores JWT in `localStorage` and attaches it as `Authorization: Bearer` on mutation requests.

### Key Data Flow

`POST /campaigns` → API creates Campaign + Messages in one DB transaction → enqueues one BullMQ job per message → Worker picks up jobs → updates message status (`sent`/`failed`) → campaign status auto-transitions to `completed` or `completed_with_failures` when all messages are processed.

### Email Strategy Pattern

`src/services/email/` uses a Factory Pattern: recipients ending in `@example.com` go to the **Mock Provider** (simulates 20% failure rate, no real network), all others go to **AWS SES**. This prevents accidental billing during load testing.

### Authentication

Single-admin JWT system. `POST /auth/login` returns a 24-hour JWT. Protected routes: `POST /campaigns`, `POST /campaigns/:id/retry`. Read endpoints are public.

### Database Schema (Prisma)

Three models: `Campaign` (status: `pending|processing|completed|completed_with_failures`), `Message` (status: `pending|queued|sent|failed`, tracks `attempts` and `lastError`), and `Admin`. Schema at `prisma/schema.prisma`.

### Resilience

- BullMQ retries failed jobs up to 3 times with exponential backoff (1s, 2s, 4s)
- Campaign/message creation is a single PostgreSQL transaction (rollback on failure)
- Worker graceful shutdown prevents in-flight job loss

### Deployment

Terraform config in `terraform/` provisions a single EC2 instance (Free Tier) that runs the full Docker Compose stack. Secrets are injected from `terraform.tfvars`.
