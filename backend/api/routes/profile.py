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
        "id,email,full_name,company_name,plan_tier,reports_used,reports_limit,slack_webhook_url,webhook_url,created_at"
    ).eq("id", user["user_id"]).single().execute()

    if not row.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return row.data


@router.patch("")
async def update_profile(body: dict, user: dict = Depends(get_current_user)):
    """Update mutable profile fields: full_name, company_name, slack_webhook_url, webhook_url."""
    allowed = {k: v for k, v in body.items() if k in ("full_name", "company_name", "slack_webhook_url", "webhook_url")}
    if not allowed:
        raise HTTPException(status_code=400, detail="No updatable fields provided")

    db = get_supabase_admin()
    db.table("profiles").update(allowed).eq("id", user["user_id"]).execute()
    return {"status": "updated"}


@router.post("/webhook/test")
async def test_webhook(user: dict = Depends(get_current_user)):
    """Send a test payload to the user's configured webhook_url to verify the connection."""
    db = get_supabase_admin()
    row = db.table("profiles").select("webhook_url,plan_tier").eq("id", user["user_id"]).single().execute()
    profile = row.data or {}

    tier = profile.get("plan_tier", "free")
    if tier not in ("pro", "agency"):
        raise HTTPException(status_code=403, detail="Outbound webhook requires Pro or Agency plan")

    webhook_url = profile.get("webhook_url")
    if not webhook_url:
        raise HTTPException(status_code=400, detail="No webhook URL configured. Save one in Settings first.")

    from utils.webhook import send_webhook_notification
    send_webhook_notification(
        webhook_url=webhook_url,
        run_id="test-00000000-0000-0000-0000-000000000000",
        run_name="Test Run — LaunchProof Webhook Verification",
        platform="meta",
        score=87.5,
        status="completed",
        passed=15,
        failed=2,
        warnings=1,
        run_url="https://app.launchproof.io",
    )
    return {"status": "sent", "webhook_url": webhook_url[:30] + "…"}
