"""
_db.py - Lightweight Supabase REST database helper for Garmin authentication serverless functions.
Uses standard HTTP requests to query Supabase REST API directly with zero heavy dependencies.
"""

import os
import sys
import json
import uuid
import datetime
from pathlib import Path
import urllib.request
import urllib.error

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_LOCAL = ROOT_DIR / ".env.local"


def get_supabase_config():
    """Load Supabase URL and Key from environment variables or .env.local fallback."""
    env = {}
    if ENV_LOCAL.exists():
        try:
            for line in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip("'\"")
        except Exception:
            pass

    url = (
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        or os.environ.get("SUPABASE_URL")
        or env.get("NEXT_PUBLIC_SUPABASE_URL")
        or env.get("SUPABASE_URL")
    )
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or env.get("SUPABASE_SERVICE_ROLE_KEY")
        or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )
    return url, key


def _supabase_request(endpoint: str, method: str = "GET", payload: dict | list | None = None, headers: dict | None = None):
    """Execute a REST request to Supabase PostgREST API."""
    url, key = get_supabase_config()
    if not url or not key:
        raise ValueError("Supabase configuration missing (URL or API key not set).")

    full_url = f"{url.rstrip('/')}/rest/v1/{endpoint.lstrip('/')}"
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if headers:
        req_headers.update(headers)

    data_bytes = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(full_url, data=data_bytes, headers=req_headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            if resp_body:
                try:
                    return json.loads(resp_body)
                except Exception:
                    return resp_body
            return None
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase HTTP {e.code} error: {err_content}") from e
    except Exception as e:
        raise RuntimeError(f"Supabase request failed: {e}") from e


def cleanup_expired_sessions():
    """Delete all expired login sessions where expires_at < NOW()."""
    try:
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        _supabase_request(f"garmin_login_sessions?expires_at=lt.{now_iso}", method="DELETE")
    except Exception as e:
        # Non-fatal log for cleanup failure
        print(f"[_db.py] Warning: cleanup_expired_sessions failed: {e}", file=sys.stderr)


def create_login_session(state: dict) -> str:
    """Store MFA state into garmin_login_sessions with 5-minute expiry, returning session_id."""
    session_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = now + datetime.timedelta(minutes=5)

    payload = {
        "session_id": session_id,
        "state": state,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    }

    _supabase_request(
        "garmin_login_sessions",
        method="POST",
        payload=payload,
        headers={"Prefer": "return=minimal"},
    )
    return session_id


def get_login_session(session_id: str) -> dict | None:
    """Retrieve session state by session_id and check if expired."""
    records = _supabase_request(f"garmin_login_sessions?session_id=eq.{session_id}&select=*")
    if not records or not isinstance(records, list) or len(records) == 0:
        return None

    record = records[0]
    expires_at_str = record.get("expires_at")
    if expires_at_str:
        # Parse ISO date
        try:
            expires_at = datetime.datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            now = datetime.datetime.now(datetime.timezone.utc)
            if now > expires_at:
                # Expired - clean up this specific record
                delete_login_session(session_id)
                return None
        except Exception:
            pass

    return record.get("state")


def delete_login_session(session_id: str):
    """Delete session by session_id."""
    try:
        _supabase_request(f"garmin_login_sessions?session_id=eq.{session_id}", method="DELETE")
    except Exception as e:
        print(f"[_db.py] Warning: delete_login_session failed: {e}", file=sys.stderr)


def save_garmin_tokens(tokens_dict: dict) -> bool:
    """Upsert tokens to garmin_tokens table (id = 1)."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    payload = {
        "id": 1,
        "tokens_json": tokens_dict,
        "updated_at": now_iso,
    }
    _supabase_request(
        "garmin_tokens?on_conflict=id",
        method="POST",
        payload=payload,
        headers={"Prefer": "resolution=merge-duplicates"},
    )
    return True
