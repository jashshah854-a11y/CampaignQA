"""
Paid Media Pre-Launch QA Tool — FastAPI Backend
Entry point.
"""
import logging
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from db.supabase_client import get_supabase_admin
from api.routes import runs, reports, checks, stripe_webhook, profile, api_keys, public_api

logger = logging.getLogger(__name__)

_INTERVAL_DELTAS = {
    "daily":   timedelta(days=1),
    "weekly":  timedelta(weeks=1),
    "monthly": timedelta(days=30),
}


def _run_scheduled_reruns() -> None:
    """
    Background thread — wakes every 15 minutes and fires scheduled re-runs.
    For each qa_run where next_run_at <= now() and schedule_interval IS NOT NULL,
    triggers a re-run using the existing raw_input and advances next_run_at.
    """
    from fastapi import BackgroundTasks
    from api.routes.runs import create_run, rerun as _rerun_endpoint
    from core.models import Platform, UrlInput, CreateRunRequest

    while True:
        time.sleep(15 * 60)  # check every 15 minutes
        try:
            db = get_supabase_admin()
            now_iso = datetime.now(timezone.utc).isoformat()
            due = db.table("qa_runs").select(
                "id,user_id,run_name,platform,raw_input,schedule_interval"
            ).not_.is_("schedule_interval", "null").lte("next_run_at", now_iso).execute()

            for row in (due.data or []):
                run_id = row["id"]
                user_id = row["user_id"]
                interval = row.get("schedule_interval")
                raw = row.get("raw_input") or {}
                raw_urls = raw.get("urls", [])
                if not raw_urls or not interval:
                    continue
                try:
                    url_inputs = [UrlInput(**u) for u in raw_urls]
                    platform = Platform(row["platform"])
                    payload = CreateRunRequest(
                        run_name=f"{row['run_name']} (scheduled)",
                        platform=platform,
                        urls=url_inputs,
                        campaign_name=raw.get("campaign_name"),
                        campaign_objective=raw.get("campaign_objective"),
                        industry_vertical=raw.get("industry_vertical"),
                        headline=raw.get("headline"),
                        primary_text=raw.get("primary_text"),
                        description=raw.get("description"),
                    )
                    user_ctx = {"user_id": user_id}
                    import asyncio
                    bt = BackgroundTasks()
                    asyncio.run(create_run(payload, bt, user_ctx))
                    bt()  # fire the background task synchronously in this thread
                    # Advance next_run_at
                    next_at = (datetime.now(timezone.utc) + _INTERVAL_DELTAS[interval]).isoformat()
                    db.table("qa_runs").update({"next_run_at": next_at}).eq("id", run_id).execute()
                    logger.info("Scheduled re-run fired for run %s (interval=%s)", run_id, interval)
                except Exception as exc:
                    logger.warning("Scheduled re-run failed for run %s: %s", run_id, exc)
        except Exception as exc:
            logger.warning("Scheduler loop error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: recover stalled runs and refresh benchmark materialized view."""
    db = get_supabase_admin()
    # 1. Recover stalled runs from server restarts
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        stalled = db.table("qa_runs").select("id").eq("status", "running").lt("started_at", cutoff).execute()
        if stalled.data:
            ids = [r["id"] for r in stalled.data]
            db.table("qa_runs").update({
                "status": "failed",
                "error_message": "Server restart during run — please resubmit",
            }).in_("id", ids).execute()
            print(f"[startup] Recovered {len(ids)} stalled run(s)")
    except Exception as e:
        print(f"[startup] Stall recovery skipped: {e}")
    # 2. Refresh benchmark materialized view (safe: no-ops if too few tenants)
    try:
        db.rpc("refresh_benchmark_view", {}).execute()
        print("[startup] Benchmark view refreshed")
    except Exception as e:
        print(f"[startup] Benchmark refresh skipped: {e}")
    # 3. Start scheduled re-run background thread
    threading.Thread(target=_run_scheduled_reruns, daemon=True).start()
    print("[startup] Scheduled re-run thread started")
    yield


settings = get_settings()

app = FastAPI(
    title="Paid Media Pre-Launch QA Tool",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(runs.router)
app.include_router(reports.router)
app.include_router(checks.router)
app.include_router(stripe_webhook.router)
app.include_router(profile.router)
app.include_router(api_keys.router)
app.include_router(public_api.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "qa-tool-backend"}
