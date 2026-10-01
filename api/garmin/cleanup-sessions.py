"""
api/garmin/cleanup-sessions.py - Serverless function to remove expired login sessions.
Can be triggered via Vercel Cron or invoked manually.
"""

import sys
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler

# Add parent directory to sys.path
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

try:
    from _db import cleanup_expired_sessions
except ImportError:
    from api.garmin._db import cleanup_expired_sessions


def _send_json(handler_instance: BaseHTTPRequestHandler, status_code: int, data: dict):
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
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        self._execute_cleanup()

    def do_POST(self):
        self._execute_cleanup()

    def _execute_cleanup(self):
        try:
            cleanup_expired_sessions()
            _send_json(self, 200, {"success": True, "message": "Expired Garmin login sessions cleaned up successfully."})
        except Exception as e:
            _send_json(self, 500, {"success": False, "error": f"Failed to cleanup expired sessions: {e}"})
