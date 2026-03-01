"""
/api/v1/pub — Public REST API authenticated via X-API-Key header.

Mirrors the main runs routes but uses API key auth instead of Supabase JWT.
Requires a Pro or Agency plan. Free users receive HTTP 403.

Endpoints:
  POST   /api/v1/pub/runs                    — create a QA run
  GET    /api/v1/pub/runs/{run_id}/status    — poll run status
  GET    /api/v1/pub/runs/{run_id}/report    — fetch completed report
  GET    /api/v1/pub/runs                    — list recent runs (newest 20)
"""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from agents.pipeline import (
    run_tier1_checks,
    run_tier2_background,
    write_check_results,
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
)
from db.supabase_client import get_supabase_admin
from utils.api_key_auth import get_user_from_api_key
from utils.url_parser import parse_url

router = APIRouter(prefix="/api/v1/pub", tags=["public-api"])


def _require_paid(user_id: str, db) -> None:
    """Raise 403 if user is on the free plan."""
    row = db.table("profiles").select("plan_tier").eq("id", user_id).single().execute()
    tier = (row.data or {}).get("plan_tier", "free")
    if tier not in ("pro", "agency"):
        raise HTTPException(
            status_code=403,
            detail="Public API requires a Pro or Agency plan. Upgrade at https://launchproof.io",
        )


@router.post("/runs", response_model=CreateRunResponse)
async def pub_create_run(
    payload: CreateRunRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_user_from_api_key),
):
    """
    Create a QA run programmatically.

    Returns run_id immediately; Tier 1 checks are synchronous, Tier 2 checks
    run in the background. Poll /pub/runs/{run_id}/status until status == 'completed'.
    """
    user_id = user["user_id"]
    db = get_supabase_admin()
    _require_paid(user_id, db)

    parsed_urls = [parse_url(u) for u in payload.urls]

    ctx = RunContext(
        run_id="",
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

    run_row = {
        "user_id": user_id,
        "run_name": payload.run_name,
        "platform": payload.platform.value,
        "input_method": "api",
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

    tier1_results = run_tier1_checks(ctx)
    write_check_results(run_id, user_id, tier1_results)

    score_so_far = calculate_readiness_score(tier1_results)
    db.table("qa_runs").update({
        "status": "running",
        "total_checks": len(tier1_results),
        "passed_checks": sum(1 for r in tier1_results if r.status == CheckStatus.passed),
        "failed_checks": sum(1 for r in tier1_results if r.status == CheckStatus.failed),
        "warning_checks": sum(1 for r in tier1_results if r.status == CheckStatus.warning),
        "readiness_score": score_so_far,
    }).eq("id", run_id).execute()

    background_tasks.add_task(run_tier2_background, run_id, user_id, ctx, tier1_results)

    return CreateRunResponse(
        run_id=run_id,
        status=RunStatus.running,
        tier1_results=[CheckResultResponse(**r.dict()) for r in tier1_results],
        message=f"QA run started via API. {len(tier1_results)} instant checks complete. Poll /status for progress.",
    )


@router.get("/runs/{run_id}/status", response_model=RunStatusResponse)
async def pub_get_status(run_id: str, user: dict = Depends(get_user_from_api_key)):
    """Poll run progress. When status == 'completed', fetch the report."""
    db = get_supabase_admin()
    row = db.table("qa_runs").select(
        "id,status,total_checks,passed_checks,failed_checks,warning_checks,readiness_score"
    ).eq("id", run_id).eq("user_id", user["user_id"]).single().execute()

    if not row.data:
        raise HTTPException(status_code=404, detail="Run not found")

    d = row.data
    status_map = {"pending": 0, "running": 60, "completed": 100, "failed": 100}

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


@router.get("/runs/{run_id}/report")
async def pub_get_report(run_id: str, user: dict = Depends(get_user_from_api_key)):
    """Fetch the full QA report for a completed run."""
    db = get_supabase_admin()
    run = db.table("qa_runs").select("*").eq("id", run_id).eq("user_id", user["user_id"]).single().execute()
    if not run.data:
        raise HTTPException(status_code=404, detail="Run not found")

    check_rows = (db.table("check_results").select("*").eq("run_id", run_id).execute().data or [])
    r = run.data

    by_category: dict[str, dict[str, int]] = {}
    for c in check_rows:
        cat = c["check_category"]
        if cat not in by_category:
            by_category[cat] = {"passed": 0, "failed": 0, "warning": 0, "error": 0, "skipped": 0}
        by_category[cat][c["status"]] = by_category[cat].get(c["status"], 0) + 1

    summary = ReportSummary(
        readiness_score=r.get("readiness_score") or 0.0,
        passed=r.get("passed_checks") or 0,
        failed=r.get("failed_checks") or 0,
        warnings=r.get("warning_checks") or 0,
        errors=sum(1 for c in check_rows if c["status"] == "error"),
        by_category=by_category,
        critical_failures=[
            c["check_name"] for c in check_rows
            if c["status"] == "failed" and c["severity"] == "critical"
        ],
    )

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
        urls=[],
        shareable_url=None,
    )


@router.get("/runs", response_model=list[dict])
async def pub_list_runs(user: dict = Depends(get_user_from_api_key)):
    """List your 20 most recent runs."""
    db = get_supabase_admin()
    result = db.table("qa_runs").select(
        "id,run_name,platform,status,readiness_score,passed_checks,failed_checks,created_at,completed_at"
    ).eq("user_id", user["user_id"]).order("created_at", desc=True).limit(20).execute()
    return result.data or []


@router.get("/runs/{run_id}/badge")
async def pub_get_badge(run_id: str, user: dict = Depends(get_user_from_api_key)):
    """
    Shields.io-compatible badge JSON for embedding in README or CI dashboards.

    Use with: https://img.shields.io/endpoint?url=<encoded_badge_url>

    Returns:
      { "schemaVersion": 1, "label": "LaunchProof", "message": "87/100", "color": "brightgreen" }
    """
    db = get_supabase_admin()
    row = db.table("qa_runs").select(
        "status,readiness_score"
    ).eq("id", run_id).eq("user_id", user["user_id"]).single().execute()

    if not row.data:
        raise HTTPException(status_code=404, detail="Run not found")

    status = row.data.get("status", "pending")
    score = row.data.get("readiness_score")

    if status == "failed":
        return {"schemaVersion": 1, "label": "LaunchProof", "message": "failed", "color": "red"}
    if status in ("pending", "running") or score is None:
        return {"schemaVersion": 1, "label": "LaunchProof", "message": "running…", "color": "lightgrey"}

    rounded = round(score)
    if rounded >= 80:
        color = "brightgreen"
    elif rounded >= 60:
        color = "yellow"
    else:
        color = "red"

    return {"schemaVersion": 1, "label": "LaunchProof", "message": f"{rounded}/100", "color": color}
