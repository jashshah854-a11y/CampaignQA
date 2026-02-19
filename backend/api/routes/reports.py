"""
Public shareable report endpoint — no auth required.
"""
from fastapi import APIRouter, HTTPException
from db.supabase_client import get_supabase_admin
from core.models import RunStatus, ReportSummary, RunReportResponse, CheckResultResponse

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])
db = get_supabase_admin()


@router.get("/share/{token}")
async def get_shared_report(token: str):
    run = db.table("qa_runs").select("*").eq("share_token", token).eq("is_public", True).single().execute()
    if not run.data:
        raise HTTPException(status_code=404, detail="Report not found or not shared publicly")

    r = run.data
    checks = db.table("check_results").select("*").eq("run_id", r["id"]).execute()
    check_rows = checks.data or []

    by_category: dict[str, dict[str, int]] = {}
    for c in check_rows:
        cat = c["check_category"]
        if cat not in by_category:
            by_category[cat] = {"passed": 0, "failed": 0, "warning": 0, "error": 0, "skipped": 0}
        by_category[cat][c["status"]] = by_category[cat].get(c["status"], 0) + 1

    critical_failures = [c["check_name"] for c in check_rows if c["status"] == "failed" and c["severity"] == "critical"]

    summary = ReportSummary(
        readiness_score=r.get("readiness_score") or 0.0,
        passed=r.get("passed_checks") or 0,
        failed=r.get("failed_checks") or 0,
        warnings=r.get("warning_checks") or 0,
        errors=sum(1 for c in check_rows if c["status"] == "error"),
        by_category=by_category,
        critical_failures=critical_failures,
    )

    return RunReportResponse(
        run_id=r["id"],
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
