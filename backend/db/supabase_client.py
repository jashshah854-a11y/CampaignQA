from supabase import create_client, Client
from core.config import get_settings
from functools import lru_cache


@lru_cache
def get_supabase() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_anon_key)


@lru_cache
def get_supabase_admin() -> Client:
    """Service role client — bypasses RLS. Use only in background workers."""
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)
