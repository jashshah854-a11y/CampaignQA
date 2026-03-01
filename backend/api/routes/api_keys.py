"""
/api/v1/api-keys — Programmatic API key management (Pro/Agency only).
Keys are stored as SHA-256 hashes. The plain key is returned only once on creation.
Key format: lp_<40 random hex chars>
"""
import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException
from db.supabase_client import get_supabase_admin
from utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])

MAX_KEYS_PER_USER = 5


def _generate_key() -> tuple[str, str, str]:
    """Returns (plain_key, prefix, key_hash)."""
    raw = secrets.token_hex(20)  # 40 hex chars = 160 bits entropy
    plain = f"lp_{raw}"
    prefix = plain[:10]          # "lp_" + first 7 chars — safe to display
    key_hash = hashlib.sha256(plain.encode()).hexdigest()
    return plain, prefix, key_hash


def _require_paid_plan(user_id: str, db) -> None:
    row = db.table("profiles").select("plan_tier").eq("id", user_id).single().execute()
    tier = (row.data or {}).get("plan_tier", "free")
    if tier not in ("pro", "agency"):
        raise HTTPException(status_code=403, detail="API key access requires Pro or Agency plan")


@router.get("")
async def list_api_keys(user: dict = Depends(get_current_user)):
    db = get_supabase_admin()
    _require_paid_plan(user["user_id"], db)
    rows = db.table("api_keys").select(
        "id,name,key_prefix,created_at,last_used_at"
    ).eq("user_id", user["user_id"]).order("created_at", desc=True).execute()
    return rows.data or []


@router.post("", status_code=201)
async def create_api_key(body: dict, user: dict = Depends(get_current_user)):
    """
    Create a new API key. Returns the plain key ONCE — store it immediately.
    Body: { "name": "My Integration" }
    """
    db = get_supabase_admin()
    _require_paid_plan(user["user_id"], db)

    # Enforce per-user limit
    existing = db.table("api_keys").select("id").eq("user_id", user["user_id"]).execute()
    if len(existing.data or []) >= MAX_KEYS_PER_USER:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_KEYS_PER_USER} API keys per account")

    name = (body.get("name") or "Default")[:64]
    plain, prefix, key_hash = _generate_key()

    db.table("api_keys").insert({
        "user_id": user["user_id"],
        "name": name,
        "key_prefix": prefix,
        "key_hash": key_hash,
    }).execute()

    return {
        "key": plain,        # shown ONCE — not stored
        "prefix": prefix,
        "name": name,
        "message": "Copy this key now — it cannot be retrieved again.",
    }


@router.delete("/{key_id}", status_code=204)
async def revoke_api_key(key_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase_admin()
    result = db.table("api_keys").delete().eq("id", key_id).eq("user_id", user["user_id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="API key not found")
