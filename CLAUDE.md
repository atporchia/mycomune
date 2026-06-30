@AGENTS.md

# FondiRadar — project notes for Claude

## What this project is

FondiRadar is a civic intelligence tool for Italian citizens. It lets people search PNRR-funded public projects in their Comune, understand them in plain Italian, and receive weekly Telegram updates. See the PRD ("Comune Watchdog PRD.pdf") for full product spec.

## Tech stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4)
- **CockroachDB Serverless** (PostgreSQL-compatible) — DB via `postgres` npm package
- **pnpm** for package management (use `pnpm`, not npm or yarn)
- **Node 20** via nvm (`nvm use 20` before any commands in this project)

## Data sources

- **Primary (ingestion):** OpenPNRR — `https://openpnrr.it` — bulk CSV export
- **Cross-check:** ItaliaDomani Open Data — `https://italiadomani.gov.it`

## Project structure

```
app/
  api/
    ingest/route.ts        # POST — full ingest run (protected by CRON_SECRET)
    ingest/calls/route.ts  # POST — upsert bandi seed data
    check/route.ts         # POST — daily source availability check
lib/
  db.ts                    # postgres client (DATABASE_URL)
  ingest/
    openpnrr.ts            # Fetch + CSV parse OpenPNRR dataset
    normalize.ts           # Map raw fields → common project schema
    calls.ts               # Seed data for funding calls (bandi aperti)
    ai.ts                  # AI explanation generation (Gemini)
  db/
    projects.ts            # upsertProjects(), rebuildComuniAggregates()
  data/
    comuni-istat.ts        # ISTAT lookup: UPPER(comune) → { province, region }
db/
  migrations/
    001_initial.sql        # Full schema: projects, comuni, ingestion_logs, source_metadata
    002_ai_columns.sql
    003_rebuild_comuni_fn.sql
    004_funding_calls.sql
    005_funding_calls_regions.sql
```

## Database tables

| Table | Purpose |
|---|---|
| `projects` | One normalized PNRR project row per (source, project_id) |
| `comuni` | Pre-aggregated stats per Comune, rebuilt after each ingest |
| `ingestion_logs` | One row per ingest run (status, counts, errors) |
| `source_metadata` | Source availability + declared update dates |
| `funding_calls` | Open funding calls (bandi aperti) for citizens/businesses |

## Environment variables

See `.env.example`. Required:
- `DATABASE_URL` — CockroachDB connection string (postgres-compatible)
- `CRON_SECRET` — header `x-cron-secret` must match to call /api/ingest and /api/check
- `GOOGLE_AI_API_KEY` — Gemini API key for AI explanations

## MVP phases

| Phase | Status | Description |
|---|---|---|
| 1 | Done | Project scaffold, schema, ingestion pipeline, homepage shell |
| 2 | Done | Comune search, dashboard, project list + detail pages |
| 3 | In progress | AI explanations (Gemini), Bandi aperti section |
| 4 | Pending | Telegram bot |
| 5 | Pending | Public launch |

## Running locally

```bash
nvm use 20
pnpm dev
```

## Triggering an ingest manually

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "x-cron-secret: YOUR_CRON_SECRET"

# Re-seed bandi aperti
curl -X POST http://localhost:3000/api/ingest/calls \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## Watch signals (neutral labels per PRD §21)

Computed in `lib/ingest/normalize.ts`:
- `high-value project` — amount >= 1M euros
- `missing expected completion date`
- `missing implementing entity`
- `unclear description`
- `generic title`

Never use: corrupt, fraud, suspicious, illegal, scandal.
