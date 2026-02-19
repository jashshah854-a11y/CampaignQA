"""
Stripe webhook handler — updates plan_tier on payment.
"""
import stripe
from fastapi import APIRouter, HTTPException, Request
from db.supabase_client import get_supabase_admin
from core.config import get_settings

router = APIRouter(prefix="/api/v1/stripe", tags=["stripe"])


@router.post("/webhook")
async def stripe_webhook(request: Request):
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("client_reference_id")
        price_id = session.get("metadata", {}).get("price_id", "")

        if not user_id:
            return {"status": "skipped"}

        db = get_supabase_admin()
        settings = get_settings()

        plan = "pro"
        if price_id == settings.stripe_price_agency_monthly:
            plan = "agency"
            report_limit = 999
        else:
            report_limit = 999  # Pro = unlimited

        db.table("profiles").update({
            "plan_tier": plan,
            "reports_limit": report_limit,
        }).eq("id", user_id).execute()

    return {"status": "ok"}
