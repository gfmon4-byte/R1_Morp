"""
api/garmin/verify-otp.py - Vercel Python Serverless Function for Garmin Connect OTP Verification (Step 2).
Validates 6-digit MFA code, finalizes authentication, and persists tokens to database.
"""

import sys
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler
import requests

# Add parent directory to sys.path to allow importing _db helper
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

try:
    from _db import get_login_session, delete_login_session, save_garmin_tokens
except ImportError:
    from api.garmin._db import get_login_session, delete_login_session, save_garmin_tokens

try:
    from garminconnect import (
        Garmin,
        GarminConnectAuthenticationError,
        GarminConnectConnectionError,
        GarminConnectTooManyRequestsError,
    )
except ImportError as err:
    Garmin = None
    _import_err = err


def _send_json(handler_instance: BaseHTTPRequestHandler, status_code: int, data: dict):
    """Helper to send a JSON response with CORS headers."""
    body_bytes = json.dumps(data).encode("utf-8")
    handler_instance.send_response(status_code)
    handler_instance.send_header("Content-Type", "application/json; charset=utf-8")
    handler_instance.send_header("Access-Control-Allow-Origin", "*")
    handler_instance.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler_instance.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler_instance.send_header("Content-Length", str(len(body_bytes)))
    handler_instance.end_headers()
    handler_instance.wfile.write(body_bytes)


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        """Process MFA OTP code verification."""
        if Garmin is None:
            return _send_json(
                self,
                500,
                {
                    "success": False,
                    "error": f"garminconnect library failed to load on server: {_import_err}",
                },
            )

        # 1. Parse JSON body
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length).decode("utf-8")
            body = json.loads(raw_body) if raw_body else {}
        except Exception as e:
            return _send_json(self, 400, {"success": False, "error": f"Invalid JSON payload: {e}"})

        session_id = (body.get("session_id") or "").strip()
        otp_code = (body.get("otp_code") or body.get("code") or body.get("mfa_code") or "").strip()

        if not session_id or not otp_code:
            return _send_json(
                self,
                400,
                {"success": False, "error": "session_id and 6-digit OTP code are required"},
            )

        # 2. Retrieve session state from Supabase
        state = get_login_session(session_id)
        if not state:
            return _send_json(
                self,
                400,
                {
                    "success": False,
                    "session_expired": True,
                    "error": "MFA login session expired or invalid (sessions expire after 5 minutes). Please start login again.",
                },
            )

        # 3. Restore Garmin client session from state
        try:
            email = state.get("email", "")
            client = Garmin(email=email, password="", return_on_mfa=True)
            c = client.client

            sess = requests.Session()
            for k, v in (state.get("cookies") or {}).items():
                sess.cookies.set(k, v)

            c._mfa_session = sess
            c.cs = sess
            c._mfa_flow = state.get("mfa_flow", "portal")
            c._mfa_method = state.get("mfa_method", "email")
            c._mfa_login_params = state.get("mfa_login_params", {})
            c._mfa_post_headers = state.get("mfa_post_headers", {})
            c._mfa_service_url = state.get("mfa_service_url")

            if state.get("widget_text"):
                class MockResp:
                    def __init__(self, text):
                        self.text = text
                c._widget_last_resp = MockResp(state["widget_text"])

        except Exception as e:
            return _send_json(
                self,
                500,
                {"success": False, "error": f"Failed to restore login session: {e}"},
            )

        # 4. Resume login with MFA code
        try:
            client.resume_login({}, otp_code)

            # Extract tokens
            tokens_json_str = client.client.dumps()
            tokens_dict = json.loads(tokens_json_str)

            if not tokens_dict.get("di_token"):
                return _send_json(
                    self,
                    500,
                    {"success": False, "error": "MFA succeeded but tokens were incomplete."},
                )

            # Persist fresh tokens into Supabase
            save_garmin_tokens(tokens_dict)

            # Delete the one-time MFA session from Supabase
            delete_login_session(session_id)

            return _send_json(
                self,
                200,
                {
                    "success": True,
                    "message": "MFA verified successfully! Fresh tokens stored to database.",
                    "display_name": getattr(client, "display_name", email or "Runner"),
                },
            )

        except GarminConnectAuthenticationError as e:
            return _send_json(
                self,
                400,
                {
                    "success": False,
                    "error_type": "MFAAuthenticationError",
                    "error": f"Invalid verification code: {str(e)}. Please check your code and try again.",
                },
            )
        except GarminConnectTooManyRequestsError as e:
            return _send_json(
                self,
                429,
                {
                    "success": False,
                    "error_type": "TooManyRequestsError",
                    "error": f"Too many MFA attempts: {str(e)}. Please wait a few minutes before trying again.",
                },
            )
        except GarminConnectConnectionError as e:
            return _send_json(
                self,
                502,
                {
                    "success": False,
                    "error_type": "ConnectionError",
                    "error": f"Connection error verifying MFA with Garmin: {str(e)}",
                },
            )
        except Exception as e:
            return _send_json(
                self,
                500,
                {
                    "success": False,
                    "error_type": "MFAError",
                    "error": f"Failed to verify MFA code: {str(e)}",
                },
            )
