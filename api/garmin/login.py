"""
api/garmin/login.py - Vercel Python Serverless Function for Garmin Connect Authentication (Step 1).
Handles email/password login and MFA session persistence.
"""

import sys
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler

# Add parent directory to sys.path to allow importing _db helper
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

try:
    from _db import create_login_session, save_garmin_tokens, cleanup_expired_sessions
except ImportError:
    from api.garmin._db import create_login_session, save_garmin_tokens, cleanup_expired_sessions

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
        """Process email & password authentication."""
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

        email = (body.get("email") or "").strip()
        password = body.get("password") or ""

        if not email or not password:
            return _send_json(
                self,
                400,
                {"success": False, "error": "Email and password are required"},
            )

        # 2. Opportunistic cleanup of expired sessions
        try:
            cleanup_expired_sessions()
        except Exception:
            pass

        # 3. Attempt Garmin login with return_on_mfa=True
        try:
            client = Garmin(email=email, password=password, return_on_mfa=True)
            # Discard user password from local scope memory immediately
            del password
            body["password"] = None

            mfa_status, _ = client.login()

            # 4. Handle MFA challenge
            if mfa_status == "needs_mfa":
                c = client.client
                sess = getattr(c, "_mfa_session", None) or getattr(c, "cs", None)
                cookies_dict = dict(sess.cookies.get_dict()) if sess else {}

                widget_resp = getattr(c, "_widget_last_resp", None)
                widget_text = widget_resp.text if widget_resp is not None else None

                state = {
                    "email": email,
                    "cookies": cookies_dict,
                    "mfa_flow": getattr(c, "_mfa_flow", "portal"),
                    "mfa_method": getattr(c, "_mfa_method", "email"),
                    "mfa_login_params": getattr(c, "_mfa_login_params", {}),
                    "mfa_post_headers": getattr(c, "_mfa_post_headers", {}),
                    "mfa_service_url": getattr(c, "_mfa_service_url", None),
                    "widget_text": widget_text,
                }

                session_id = create_login_session(state)

                return _send_json(
                    self,
                    200,
                    {
                        "success": True,
                        "needs_mfa": True,
                        "session_id": session_id,
                        "message": "Garmin MFA verification required. Please enter the 6-digit code.",
                    },
                )

            # 5. Handle direct success without MFA
            tokens_json_str = client.client.dumps()
            tokens_dict = json.loads(tokens_json_str)

            if not tokens_dict.get("di_token"):
                return _send_json(
                    self,
                    500,
                    {"success": False, "error": "Login succeeded but received incomplete tokens."},
                )

            save_garmin_tokens(tokens_dict)

            return _send_json(
                self,
                200,
                {
                    "success": True,
                    "needs_mfa": False,
                    "message": "Successfully logged in to Garmin Connect! Tokens saved to database.",
                    "display_name": getattr(client, "display_name", email),
                },
            )

        except GarminConnectAuthenticationError as e:
            return _send_json(
                self,
                401,
                {
                    "success": False,
                    "error_type": "AuthenticationError",
                    "error": f"Authentication failed: {str(e)}",
                },
            )
        except GarminConnectTooManyRequestsError as e:
            return _send_json(
                self,
                429,
                {
                    "success": False,
                    "error_type": "TooManyRequestsError",
                    "error": f"Garmin rate limit reached (HTTP 429): {str(e)}. Please wait 5–10 minutes before retrying.",
                },
            )
        except GarminConnectConnectionError as e:
            return _send_json(
                self,
                502,
                {
                    "success": False,
                    "error_type": "ConnectionError",
                    "error": f"Connection error contacting Garmin servers: {str(e)}",
                },
            )
        except Exception as e:
            return _send_json(
                self,
                500,
                {
                    "success": False,
                    "error_type": "UnexpectedError",
                    "error": f"Login error: {str(e)}",
                },
            )
