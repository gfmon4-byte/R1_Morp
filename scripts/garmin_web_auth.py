#!/usr/bin/env python3
"""
garmin_web_auth.py - Stateless Garmin Connect Authentication CLI using pure JSON state.
Designed to work across serverless stateless HTTP requests.

Supports two stateless steps:
  1. action="login": Logs in with email/password.
     - If success: saves tokens directly to Supabase DB and returns success.
     - If needs_mfa: returns base64 JSON string containing MFA session cookies & params.
  2. action="mfa": Restores session from base64 JSON state, submits 6-digit code.
     - Saves tokens directly to Supabase DB and returns success.
"""

import sys
import os
import json
import base64
import datetime
import urllib.request
from pathlib import Path
import requests

# Fix Windows/console encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

try:
    from garminconnect import (
        Garmin,
        GarminConnectAuthenticationError,
        GarminConnectConnectionError,
        GarminConnectTooManyRequestsError,
    )
except ImportError:
    print(json.dumps({
        "status": "error",
        "error_type": "ImportError",
        "message": "garminconnect is not installed. Run: pip install -r garmin_requirements.txt"
    }), flush=True)
    sys.exit(1)

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_LOCAL = ROOT_DIR / ".env.local"


def get_supabase_config():
    """Load Supabase URL and Key from environment or .env.local."""
    env = {}
    if ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    return url, key


def save_tokens_to_supabase(tokens_dict: dict) -> bool:
    """Save token dictionary to Supabase garmin_tokens table (upsert id=1)."""
    url, key = get_supabase_config()
    if not url or not key:
        return False

    req_url = f"{url.rstrip('/')}/rest/v1/garmin_tokens?on_conflict=id"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = json.dumps({
        "id": 1,
        "tokens_json": tokens_dict,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }).encode("utf-8")

    req = urllib.request.Request(req_url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 201, 204)
    except Exception as e:
        print(f"⚠️ Error saving tokens to Supabase DB: {e}", file=sys.stderr)
        return False


def decode_jwt_payload(token_str: str) -> dict:
    """Safely decode JWT payload without verification for inspection."""
    try:
        parts = token_str.split(".")
        if len(parts) < 2:
            return {}
        payload = parts[1]
        payload += "=" * ((4 - len(payload) % 4) % 4)
        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded.decode("utf-8"))
    except Exception:
        return {}


def serialize_mfa_state(garmin_instance: Garmin) -> str:
    """Serialize the MFA state into a pure JSON string encoded in base64."""
    c = garmin_instance.client
    sess = getattr(c, "_mfa_session", None) or getattr(c, "cs", None)
    cookies_dict = dict(sess.cookies.get_dict()) if sess else {}

    widget_resp = getattr(c, "_widget_last_resp", None)
    widget_text = widget_resp.text if widget_resp is not None else None

    state = {
        "username": garmin_instance.username,
        "cookies": cookies_dict,
        "mfa_flow": getattr(c, "_mfa_flow", "ios"),
        "mfa_method": getattr(c, "_mfa_method", "email"),
        "mfa_login_params": getattr(c, "_mfa_login_params", {}),
        "mfa_post_headers": getattr(c, "_mfa_post_headers", {}),
        "mfa_service_url": getattr(c, "_mfa_service_url", None),
        "widget_text": widget_text,
    }
    return base64.b64encode(json.dumps(state).encode("utf-8")).decode("utf-8")


def restore_mfa_client(state_b64: str) -> Garmin:
    """Recreate a Garmin client from the serialized base64 JSON state."""
    raw_json = base64.b64decode(state_b64.encode("utf-8")).decode("utf-8")
    state = json.loads(raw_json)

    client = Garmin(email=state.get("username", ""), password="", return_on_mfa=True)
    c = client.client

    # Create fresh requests.Session and restore cookies
    sess = requests.Session()
    for k, v in state.get("cookies", {}).items():
        sess.cookies.set(k, v)

    c._mfa_session = sess
    c.cs = sess
    c._mfa_flow = state.get("mfa_flow", "ios")
    c._mfa_method = state.get("mfa_method", "email")
    c._mfa_login_params = state.get("mfa_login_params", {})
    c._mfa_post_headers = state.get("mfa_post_headers", {})
    c._mfa_service_url = state.get("mfa_service_url")

    if state.get("widget_text"):
        class MockResp:
            def __init__(self, text):
                self.text = text
        c._widget_last_resp = MockResp(state["widget_text"])

    return client


def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            print(json.dumps({"status": "error", "message": "No JSON payload received on stdin"}))
            sys.exit(1)

        req = json.loads(raw_input)
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Invalid JSON input: {e}"}))
        sys.exit(1)

    action = req.get("action", "login")

    # ── STEP 1: Login with Email & Password ────────────────────────────────────
    if action == "login":
        email = req.get("email", "").strip()
        password = req.get("password", "").strip()

        if not email or not password:
            print(json.dumps({"status": "error", "message": "Email and password are required"}))
            sys.exit(1)

        try:
            client = Garmin(email=email, password=password, return_on_mfa=True)
            mfa_status, _ = client.login()

            if mfa_status == "needs_mfa":
                # Serialize the state into clean JSON (no pickle)
                serialized_state = serialize_mfa_state(client)
                print(json.dumps({
                    "status": "needs_mfa",
                    "mfa_state": serialized_state,
                    "message": "Garmin MFA / 2FA verification required. Please enter the 6-digit code sent to your email or authenticator."
                }))
                sys.exit(0)

            # Login succeeded directly without MFA
            tokens_json = client.client.dumps()
            parsed_tokens = json.loads(tokens_json)
            save_tokens_to_supabase(parsed_tokens)

            jwt_payload = decode_jwt_payload(parsed_tokens.get("di_token", ""))
            expires_at = jwt_payload.get("exp")

            print(json.dumps({
                "status": "success",
                "message": "Successfully logged in to Garmin Connect and tokens saved to database!",
                "display_name": getattr(client, "display_name", email),
                "full_name": getattr(client, "full_name", ""),
                "expires_at": expires_at,
                "tokens": parsed_tokens
            }))
            sys.exit(0)

        except GarminConnectAuthenticationError as e:
            print(json.dumps({
                "status": "error",
                "error_type": "AuthenticationError",
                "message": f"Authentication failed: {str(e)}"
            }))
            sys.exit(1)
        except GarminConnectTooManyRequestsError as e:
            print(json.dumps({
                "status": "error",
                "error_type": "TooManyRequestsError",
                "message": f"Too many requests (Rate limited by Garmin): {str(e)}"
            }))
            sys.exit(1)
        except GarminConnectConnectionError as e:
            print(json.dumps({
                "status": "error",
                "error_type": "ConnectionError",
                "message": f"Connection error: {str(e)}"
            }))
            sys.exit(1)
        except Exception as e:
            print(json.dumps({
                "status": "error",
                "error_type": "UnexpectedError",
                "message": f"Login error: {str(e)}"
            }))
            sys.exit(1)

    # ── STEP 2: Submit 6-digit MFA Code ────────────────────────────────────────
    elif action == "mfa":
        mfa_code = req.get("code", "").strip()
        mfa_state = req.get("mfa_state", "").strip()

        if not mfa_code:
            print(json.dumps({"status": "error", "message": "MFA code is required"}))
            sys.exit(1)
        if not mfa_state:
            print(json.dumps({"status": "error", "message": "Missing MFA session state. Please start login again."}))
            sys.exit(1)

        try:
            client = restore_mfa_client(mfa_state)
        except Exception as e:
            print(json.dumps({"status": "error", "message": f"Invalid or expired MFA session state: {e}"}))
            sys.exit(1)

        try:
            client.resume_login({}, mfa_code)

            tokens_json = client.client.dumps()
            parsed_tokens = json.loads(tokens_json)
            save_tokens_to_supabase(parsed_tokens)

            jwt_payload = decode_jwt_payload(parsed_tokens.get("di_token", ""))
            expires_at = jwt_payload.get("exp")

            print(json.dumps({
                "status": "success",
                "message": "Garmin MFA verified successfully! Tokens saved to database.",
                "display_name": getattr(client, "display_name", getattr(client, "username", "Runner")),
                "full_name": getattr(client, "full_name", ""),
                "expires_at": expires_at,
                "tokens": parsed_tokens
            }))
            sys.exit(0)

        except GarminConnectAuthenticationError as e:
            print(json.dumps({
                "status": "error",
                "error_type": "MFAAuthenticationError",
                "message": f"MFA verification failed (Invalid code or expired): {str(e)}"
            }))
            sys.exit(1)
        except Exception as e:
            print(json.dumps({
                "status": "error",
                "error_type": "MFAError",
                "message": f"Failed to complete MFA verification: {str(e)}"
            }))
            sys.exit(1)

    else:
        print(json.dumps({"status": "error", "message": f"Unknown action: {action}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
