"""
Stripe webhook handler + checkout session creator.
"""
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from db.supabase_client import get_supabase_admin
from core.config import get_settings
from utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/stripe", tags=["stripe"])


@router.post("/create-checkout-session")
async def create_checkout_session(body: dict, user: dict = Depends(get_current_user)):
    """Create a Stripe Checkout session for plan upgrade.
    Body: {"plan": "pro" | "agency", "success_url": "...", "cancel_url": "..."}
    """
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Payments not configured")

    stripe.api_key = settings.stripe_secret_key
    plan = body.get("plan", "pro")
    price_id = (
        settings.stripe_price_agency_monthly if plan == "agency"
        else settings.stripe_price_pro_monthly
    )
    if not price_id:
        raise HTTPException(status_code=503, detail="Stripe price not configured")

    success_url = body.get("success_url", "")
    cancel_url = body.get("cancel_url", "")

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        client_reference_id=user["user_id"],
        customer_email=user.get("email"),
        metadata={"price_id": price_id},
        success_url=success_url or f"{settings.cors_origins_list[0]}/dashboard?upgraded=1",
        cancel_url=cancel_url or f"{settings.cors_origins_list[0]}/dashboard",
    )
    return {"checkout_url": session.url}


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

        plan = "pro"
        if price_id == settings.stripe_price_agency_monthly:
            plan = "agency"

        db.table("profiles").update({
            "plan_tier": plan,
            "reports_limit": 999,
        }).eq("id", user_id).execute()

    return {"status": "ok"}
