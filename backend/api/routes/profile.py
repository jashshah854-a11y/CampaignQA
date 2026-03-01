"""
/api/v1/profile — Current user's plan, usage, and account info.
"""
from fastapi import APIRouter, Depends, HTTPException
from db.supabase_client import get_supabase_admin
from utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


@router.get("")
async def get_profile(user: dict = Depends(get_current_user)):
    db = get_supabase_admin()
    row = db.table("profiles").select(
        "id,email,full_name,company_name,plan_tier,reports_used,reports_limit,created_at"
    ).eq("id", user["user_id"]).single().execute()

    if not row.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return row.data


@router.patch("")
async def update_profile(body: dict, user: dict = Depends(get_current_user)):
    """Update mutable profile fields: full_name, company_name."""
    allowed = {k: v for k, v in body.items() if k in ("full_name", "company_name")}
    if not allowed:
        raise HTTPException(status_code=400, detail="No updatable fields provided")

    db = get_supabase_admin()
    db.table("profiles").update(allowed).eq("id", user["user_id"]).execute()
    return {"status": "updated"}
