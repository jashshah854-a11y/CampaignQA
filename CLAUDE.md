# CampaignQA — Paid Media Pre-Launch QA Tool

## What This Is
SaaS tool for paid media managers to QA campaigns before launch. Checks UTM parameters, URL structure, ad copy character limits, and link reachability. Produces a scored readiness report (0-100). Shareable report URL for client delivery.

## Stack
- **Backend**: Python 3.11 + FastAPI + Supabase (PostgreSQL + Auth) — Railway deploy
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS — Vercel deploy
- **Payments**: Stripe Checkout (hosted) + webhook to update `profiles.plan_tier`
- **Auth**: Supabase Auth (magic link) — JWT validated in FastAPI middleware

## Directory Structure
```
QA_Tool/
├── backend/
│   ├── main.py                    ← FastAPI app, CORS, startup recovery
│   ├── requirements.txt
│   ├── nixpacks.toml / railway.toml
│   ├── supabase_schema.sql        ← Run in Supabase SQL editor
│   ├── core/
│   │   ├── config.py              ← Settings from env vars
│   │   └── models.py              ← Pydantic models (RunContext, CheckResult, etc.)
│   ├── db/
│   │   └── supabase_client.py     ← get_supabase() / get_supabase_admin()
│   ├── agents/
│   │   ├── pipeline.py            ← Tier 1/2 executor, score calc, background task
│   │   └── checks/
│   │       ├── base.py            ← BaseCheck + CheckRegistry
│   │       ├── tier1/             ← Sync checks (UTM, creative, URL structure, budget)
│   │       └── tier2/             ← Async I/O checks (reachability, redirects, UTM preservation)
│   ├── api/routes/
│   │   ├── runs.py                ← POST /runs, GET /runs/{id}/status, GET /runs/{id}/report
│   │   ├── reports.py             ← GET /reports/share/{token} (public, no auth)
│   │   ├── checks.py              ← GET /checks, PATCH /runs/{id}/share
│   │   └── stripe_webhook.py      ← POST /stripe/webhook
│   └── utils/
│       ├── auth.py                ← JWT validation (get_current_user dependency)
│       └── url_parser.py          ← URL parsing to ParsedUrl
└── frontend/
    ├── src/
    │   ├── App.tsx                ← Router + auth guard
    │   ├── contexts/AuthContext.tsx
    │   ├── hooks/useRunPoller.ts  ← 2s polling until completed/failed
    │   ├── lib/
    │   │   ├── api.ts             ← All API calls (typed)
    │   │   ├── supabase.ts        ← Supabase client
    │   │   └── utils.ts           ← cn(), scoreColor(), statusIcon()
    │   ├── pages/
    │   │   ├── LoginPage.tsx      ← Supabase Auth UI
    │   │   ├── DashboardPage.tsx  ← List runs
    │   │   ├── NewRunPage.tsx     ← Create run form
    │   │   ├── RunPage.tsx        ← Polling progress view
    │   │   ├── ReportPage.tsx     ← Full scored report
    │   │   └── SharedReportPage.tsx ← Public share (no auth)
    │   └── components/
    │       ├── CheckCard.tsx      ← Expandable check result card
    │       └── ScoreGauge.tsx     ← Readiness score display
    └── vercel.json                ← SPA rewrite rule
```

## Check Engine Architecture
All checks inherit `BaseCheck`. Auto-registered via `CheckRegistry.register(cls())`.
- **Tier 1** (sync, runs in request handler): UTM presence/format, URL structure, creative char limits, budget validation
- **Tier 2** (async, runs in BackgroundTask): URL reachability, redirect depth, UTM preservation through redirects
- **Adding a check**: Create class in `agents/checks/tier1/` or `tier2/`, register at bottom of file

## Readiness Score Formula
`score = (passed_critical*4 + passed_major*2 + passed_minor*1) / (total_critical*4 + total_major*2 + total_minor*1) * 100`
- Errors + Skipped: excluded from denominator (don't penalize)
- Warnings: count as 0.5× credit

## Database (Supabase)
Tables: `profiles`, `qa_runs`, `check_results`, `campaign_urls`, `audit_log`
- All tables have RLS enabled. Users see only their own rows.
- Service role key bypasses RLS (used in background workers only — never expose to frontend)
- `increment_reports_used(uid)` SQL function handles free-tier counter safely
- `benchmark_snapshots` materialized view — Rule of 10 enforced (min 10 tenants)

## Plans & Limits
- **Free**: 3 reports (tracked in `profiles.reports_used` / `profiles.reports_limit`)
- **Pro**: Unlimited ($29/month via Stripe)
- **Agency**: Unlimited ($79/month via Stripe)
- Upgrade flow: Stripe Checkout → webhook → update `profiles.plan_tier`

## Environment Variables
Backend `.env`:
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET  ← copy from Supabase Dashboard > Project Settings > JWT Secret
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_AGENCY_MONTHLY
CORS_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
```

Frontend `.env.local`:
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
VITE_API_URL=http://localhost:8000
```

## Local Dev
```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # fill in values
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.example .env.local  # fill in values
npm run dev
```

## Deploy
1. **Supabase**: Run `supabase_schema.sql` in SQL editor
2. **Railway (backend)**: Connect GitHub repo → set env vars → nixpacks auto-detected
3. **Vercel (frontend)**: Connect GitHub repo → set VITE_ env vars → deploy

## Key Decisions
- **BackgroundTasks not Celery**: Acceptable for MVP. Startup recovery handler marks stalled runs as failed.
- **No PDF generation**: HTML report with print CSS. PDF = browser feature.
- **Free tier = run count, not time**: Simpler to implement and clearer UX.
- **Shared report URL**: `share_token` on `qa_runs`. Enable sharing with `PATCH /runs/{id}/share`. Growth loop.
- **Raw input stored as JSONB**: Enables re-running checks with new logic against historical data.
