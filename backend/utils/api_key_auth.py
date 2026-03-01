"""
API key authentication dependency.

Validates X-API-Key: lp_xxx headers against the api_keys table (SHA-256 hash lookup).
Updates last_used_at on every successful auth.
Returns the same {user_id, email} dict as get_current_user() for drop-in compatibility.
"""
import hashlib
from datetime import datetime, timezone

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from db.supabase_client import get_supabase_admin

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)


def get_user_from_api_key(api_key: str = Security(_api_key_header)) -> dict:
    """FastAPI dependency: authenticate via X-API-Key header."""
    if not api_key.startswith("lp_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format. Keys must start with 'lp_'.",
        )

    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    db = get_supabase_admin()

    row = db.table("api_keys").select("id,user_id").eq("key_hash", key_hash).single().execute()
    if not row.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key.",
        )

    key_id = row.data["id"]
    user_id = row.data["user_id"]

    # Update last_used_at — best-effort, never block the request
    try:
        db.table("api_keys").update({
            "last_used_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", key_id).execute()
    except Exception:
        pass

    profile = db.table("profiles").select("email").eq("id", user_id).single().execute()
    email = (profile.data or {}).get("email", "")

    return {"user_id": user_id, "email": email}
