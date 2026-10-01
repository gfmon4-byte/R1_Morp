"""
api/garmin/cleanup_sessions.py - Alias for api/garmin/cleanup-sessions.py
"""

import importlib.util
from pathlib import Path
import sys

_target = Path(__file__).resolve().parent / "cleanup-sessions.py"
_spec = importlib.util.spec_from_file_location("cleanup_sessions_impl", _target)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["cleanup_sessions_impl"] = _mod
_spec.loader.exec_module(_mod)

handler = _mod.handler
