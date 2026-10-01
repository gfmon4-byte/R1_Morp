#!/usr/bin/env python3
"""
login_garmin.py - Authenticate with Garmin Connect and save tokens directly to Supabase DB.

Usage:
    python scripts/login_garmin.py
"""

import sys
import json
import getpass
import os
import datetime
import urllib.request
from pathlib import Path

# Fix Windows console encoding for Unicode emojis
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
    sys.exit("Error: garminconnect is not installed. Run: pip install -r garmin_requirements.txt")

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
        print("⚠️ Supabase credentials not found in env or .env.local.")
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
        print(f"⚠️ Error saving tokens to Supabase DB: {e}")
        return False


def get_mfa_code() -> str:
    print("\n📩 Garmin MFA / 2FA verification required.")
    code = input("Enter the 6-digit MFA code (from Email or Authenticator App): ").strip()
    return code


def main():
    print("========================================")
    print(" 🏃 Garmin Connect Re-Authentication")
    print("========================================")
    print("Please enter your Garmin Connect credentials:")
    
    email = input("Garmin Email: ").strip()
    if not email:
        print("Error: Email cannot be empty.")
        sys.exit(1)
        
    password = getpass.getpass("Garmin Password: ")
    if not password:
        print("Error: Password cannot be empty.")
        sys.exit(1)

    print("\nAuthenticating with Garmin Connect...")
    try:
        client = Garmin(email=email, password=password, prompt_mfa=get_mfa_code)
        client.login()
    except GarminConnectAuthenticationError as e:
        print(f"\n❌ Authentication failed: {e}")
        print("Please check your email, password, or MFA code and try again.")
        sys.exit(1)
    except GarminConnectTooManyRequestsError as e:
        print(f"\n❌ Too many requests: {e}")
        print("Please wait a few minutes before trying again.")
        sys.exit(1)
    except GarminConnectConnectionError as e:
        print(f"\n❌ Connection error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error during login: {e}")
        sys.exit(1)

    # Serialize tokens
    tokens_json = client.client.dumps()
    parsed = json.loads(tokens_json)

    if not parsed.get("di_token") or not parsed.get("di_refresh_token"):
        print("\n❌ Failed: Login succeeded but tokens were incomplete.")
        sys.exit(1)

    # Save directly to Supabase DB
    ok = save_tokens_to_supabase(parsed)
    if ok:
        print("\n✅ Successfully authenticated and saved fresh tokens to Supabase DB (table: garmin_tokens)!")
    else:
        print("\n⚠️ Authenticated successfully, but failed to write to Supabase DB.")


if __name__ == "__main__":
    main()
