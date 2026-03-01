"""
/api/v1/checks — List all available check definitions.
Also: enable/disable sharing for a run.
"""
from fastapi import APIRouter, Depends, HTTPException
from agents.checks.base import CheckRegistry
from db.supabase_client import get_supabase_admin
from utils.auth import get_current_user

router = APIRouter(prefix="/api/v1", tags=["checks"])


@router.get("/checks")
async def list_checks():
    return CheckRegistry.all_definitions()


@router.get("/benchmark")
async def get_benchmark(platform: str = "universal", industry_vertical: str = ""):
    """
    Returns aggregate pass rates from the benchmark_snapshots materialized view.
    Requires Rule of 10 — if insufficient data, returns empty list (not an error).
    Used by the frontend to show how a user's score compares to the platform average.
    """
    db = get_supabase_admin()
    try:
        query = db.table("benchmark_snapshots").select(
            "check_id,check_category,pass_rate_pct,check_count,tenant_count"
        )
        if platform and platform != "universal":
            query = query.eq("platform", platform)
        if industry_vertical:
            query = query.eq("industry_vertical", industry_vertical)
        result = query.order("check_id").execute()
        # Aggregate by check_id (avg pass rate across time windows)
        aggregated: dict[str, dict] = {}
        for row in (result.data or []):
            cid = row["check_id"]
            if cid not in aggregated:
                aggregated[cid] = {
                    "check_id": cid,
                    "check_category": row["check_category"],
                    "pass_rate_pct": row["pass_rate_pct"],
                    "count": 1,
                }
            else:
                cur = aggregated[cid]
                cur["pass_rate_pct"] = round(
                    (cur["pass_rate_pct"] * cur["count"] + row["pass_rate_pct"]) / (cur["count"] + 1), 1
                )
                cur["count"] += 1
        return list(aggregated.values())
    except Exception:
        return []  # benchmark view may not exist yet — graceful fallback


@router.patch("/runs/{run_id}/share")
async def toggle_share(run_id: str, body: dict, user: dict = Depends(get_current_user)):
    """Enable or disable public sharing for a run. Body: {"is_public": true|false}"""
    db = get_supabase_admin()
    is_public = body.get("is_public", False)
    result = db.table("qa_runs").update({"is_public": is_public}).eq("id", run_id).eq("user_id", user["user_id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"run_id": run_id, "is_public": is_public}
