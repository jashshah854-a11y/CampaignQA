"""
/api/v1/runs — Create, list, poll, and fetch QA runs.
"""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from agents.pipeline import (
    run_tier1_checks,
    run_tier2_background,
    write_check_results,
    update_run_summary,
    calculate_readiness_score,
)
from core.models import (
    CreateRunRequest,
    CreateRunResponse,
    RunContext,
    RunReportResponse,
    RunStatus,
    RunStatusResponse,
    ReportSummary,
    CheckResultResponse,
    CheckStatus,
    Severity,
)
from db.supabase_client import get_supabase_admin
from utils.auth import get_current_user
from utils.url_parser import parse_url

router = APIRouter(prefix="/api/v1/runs", tags=["runs"])
db = get_supabase_admin()

FREE_TIER_LIMIT = 3


def _enforce_free_tier(user_id: str) -> None:
    profile = db.table("profiles").select("plan_tier,reports_used,reports_limit").eq("id", user_id).single().execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    p = profile.data
    if p["plan_tier"] == "free" and p["reports_used"] >= p["reports_limit"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Free tier limit of {p['reports_limit']} reports reached. Upgrade to Pro to continue.",
        )


def _increment_reports_used(user_id: str) -> None:
    db.rpc("increment_reports_used", {"uid": user_id}).execute()


@router.post("", response_model=CreateRunResponse)
async def create_run(
    payload: CreateRunRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    user_id = user["user_id"]
    _enforce_free_tier(user_id)

    # Parse URLs
    parsed_urls = [parse_url(u) for u in payload.urls]

    # Build run context
    ctx = RunContext(
        run_id="",  # filled after DB insert
        user_id=user_id,
        platform=payload.platform,
        urls=parsed_urls,
        campaign_name=payload.campaign_name,
        campaign_objective=payload.campaign_objective,
        industry_vertical=payload.industry_vertical,
        headline=payload.headline,
        primary_text=payload.primary_text,
        description=payload.description,
    )

    # Insert qa_run row
    run_row = {
        "user_id": user_id,
        "run_name": payload.run_name,
        "platform": payload.platform.value,
        "input_method": "manual",
        "raw_input": {
            "urls": [u.dict() for u in payload.urls],
            "campaign_name": payload.campaign_name,
            "campaign_objective": payload.campaign_objective,
            "industry_vertical": payload.industry_vertical,
            "headline": payload.headline,
            "primary_text": payload.primary_text,
            "description": payload.description,
        },
        "status": "pending",
        "share_token": secrets.token_urlsafe(12),
        "industry_vertical": payload.industry_vertical,
        "campaign_objective": payload.campaign_objective,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    run_result = db.table("qa_runs").insert(run_row).execute()
    run_id = run_result.data[0]["id"]
    ctx.run_id = run_id

    # Insert campaign_urls
    url_rows = [
        {
            "run_id": run_id,
            "user_id": user_id,
            "raw_url": u.raw_url,
            "parsed_url": {"host": u.host, "path": u.path, "params": u.params},
            "ad_name": u.ad_name,
            "ad_set_name": u.ad_set_name,
            "campaign_name": u.campaign_name,
        }
        for u in parsed_urls
    ]
    db.table("campaign_urls").insert(url_rows).execute()

    # Run Tier 1 checks synchronously
    tier1_results = run_tier1_checks(ctx)
    write_check_results(run_id, user_id, tier1_results)

    # Update partial summary after Tier 1
    score_so_far = calculate_readiness_score(tier1_results)
    db.table("qa_runs").update({
        "status": "running",
        "total_checks": len(tier1_results),
        "passed_checks": sum(1 for r in tier1_results if r.status == CheckStatus.passed),
        "failed_checks": sum(1 for r in tier1_results if r.status == CheckStatus.failed),
        "warning_checks": sum(1 for r in tier1_results if r.status == CheckStatus.warning),
        "readiness_score": score_so_far,
    }).eq("id", run_id).execute()

    # Increment usage counter
    _increment_reports_used(user_id)

    # Dispatch Tier 2 in background
    background_tasks.add_task(run_tier2_background, run_id, user_id, ctx, tier1_results)

    return CreateRunResponse(
        run_id=run_id,
        status=RunStatus.running,
        tier1_results=[CheckResultResponse(**r.dict()) for r in tier1_results],
        message=f"QA run started. {len(tier1_results)} instant checks complete. URL reachability checks running...",
    )


@router.get("/{run_id}/status", response_model=RunStatusResponse)
async def get_run_status(run_id: str, user: dict = Depends(get_current_user)):
    row = db.table("qa_runs").select(
        "id,status,total_checks,passed_checks,failed_checks,warning_checks,readiness_score"
    ).eq("id", run_id).eq("user_id", user["user_id"]).single().execute()

    if not row.data:
        raise HTTPException(status_code=404, detail="Run not found")
    d = row.data

    status_map = {
        "pending": 0,
        "running": 60,
        "completed": 100,
        "failed": 100,
    }

    return RunStatusResponse(
        run_id=run_id,
        status=RunStatus(d["status"]),
        progress_pct=status_map.get(d["status"], 50),
        readiness_score=d.get("readiness_score"),
        total_checks=d.get("total_checks"),
        passed_checks=d.get("passed_checks"),
        failed_checks=d.get("failed_checks"),
        warning_checks=d.get("warning_checks"),
    )


@router.get("/{run_id}/report", response_model=RunReportResponse)
async def get_run_report(run_id: str, user: dict = Depends(get_current_user)):
    run = db.table("qa_runs").select("*").eq("id", run_id).eq("user_id", user["user_id"]).single().execute()
    if not run.data:
        raise HTTPException(status_code=404, detail="Run not found")

    checks = db.table("check_results").select("*").eq("run_id", run_id).execute()
    urls = db.table("campaign_urls").select("*").eq("run_id", run_id).execute()

    r = run.data
    check_rows = checks.data or []

    # Build by_category summary
    by_category: dict[str, dict[str, int]] = {}
    for c in check_rows:
        cat = c["check_category"]
        if cat not in by_category:
            by_category[cat] = {"passed": 0, "failed": 0, "warning": 0, "error": 0, "skipped": 0}
        by_category[cat][c["status"]] = by_category[cat].get(c["status"], 0) + 1

    critical_failures = [
        c["check_name"] for c in check_rows
        if c["status"] == "failed" and c["severity"] == "critical"
    ]

    summary = ReportSummary(
        readiness_score=r.get("readiness_score") or 0.0,
        passed=r.get("passed_checks") or 0,
        failed=r.get("failed_checks") or 0,
        warnings=r.get("warning_checks") or 0,
        errors=sum(1 for c in check_rows if c["status"] == "error"),
        by_category=by_category,
        critical_failures=critical_failures,
    )

    settings_obj = __import__("core.config", fromlist=["get_settings"]).get_settings()
    frontend_url = settings_obj.cors_origins_list[0] if settings_obj.cors_origins_list else ""
    share_url = f"{frontend_url}/reports/share/{r.get('share_token')}" if r.get("share_token") else None

    return RunReportResponse(
        run_id=run_id,
        run_name=r["run_name"],
        platform=r["platform"],
        status=RunStatus(r["status"]),
        created_at=r["created_at"],
        completed_at=r.get("completed_at"),
        summary=summary,
        checks=[CheckResultResponse(**{
            "check_id": c["check_id"],
            "check_name": c["check_name"],
            "check_category": c["check_category"],
            "platform": c["platform"],
            "status": c["status"],
            "severity": c["severity"],
            "message": c["message"],
            "recommendation": c.get("recommendation"),
            "affected_items": c.get("affected_items") or [],
            "execution_ms": c.get("execution_ms") or 0,
        }) for c in sorted(check_rows, key=lambda x: (
            {"critical": 0, "major": 1, "minor": 2}[x["severity"]],
            {"failed": 0, "warning": 1, "error": 2, "passed": 3, "skipped": 4}[x["status"]],
        ))],
        urls=urls.data or [],
        shareable_url=share_url,
    )


@router.get("", response_model=list[dict])
async def list_runs(user: dict = Depends(get_current_user)):
    result = db.table("qa_runs").select(
        "id,run_name,platform,status,readiness_score,total_checks,passed_checks,failed_checks,created_at,completed_at"
    ).eq("user_id", user["user_id"]).order("created_at", desc=True).limit(50).execute()
    return result.data or []
