"""
JWT auth middleware — validates Supabase-issued JWTs via Supabase API.
"""
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from db.supabase_client import get_supabase

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    token = credentials.credentials
    try:
        client = get_supabase()
        response = client.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"user_id": str(response.user.id), "email": response.user.email or ""}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
