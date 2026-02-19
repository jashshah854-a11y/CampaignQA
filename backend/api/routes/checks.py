"""
/api/v1/checks — List all available check definitions.
Also: enable/disable sharing for a run.
"""
from fastapi import APIRouter, Depends, HTTPException
from agents.checks.base import CheckRegistry
from db.supabase_client import get_supabase_admin
from utils.auth import get_current_user

router = APIRouter(prefix="/api/v1", tags=["checks"])
db = get_supabase_admin()


@router.get("/checks")
async def list_checks():
    return CheckRegistry.all_definitions()


@router.patch("/runs/{run_id}/share")
async def toggle_share(run_id: str, body: dict, user: dict = Depends(get_current_user)):
    """Enable or disable public sharing for a run. Body: {"is_public": true|false}"""
    is_public = body.get("is_public", False)
    result = db.table("qa_runs").update({"is_public": is_public}).eq("id", run_id).eq("user_id", user["user_id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"run_id": run_id, "is_public": is_public}
