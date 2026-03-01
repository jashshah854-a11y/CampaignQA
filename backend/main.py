"""
Paid Media Pre-Launch QA Tool — FastAPI Backend
Entry point.
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from db.supabase_client import get_supabase_admin
from api.routes import runs, reports, checks, stripe_webhook, profile, api_keys


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: recover stalled runs from server restarts."""
    try:
        db = get_supabase_admin()
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
        print(f"[startup] Supabase recovery skipped: {e}")
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "qa-tool-backend"}
