"""
api/garmin/verify_otp.py - Alias for api/garmin/verify-otp.py
"""

import importlib.util
from pathlib import Path
import sys

_target = Path(__file__).resolve().parent / "verify-otp.py"
_spec = importlib.util.spec_from_file_location("verify_otp_impl", _target)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["verify_otp_impl"] = _mod
_spec.loader.exec_module(_mod)

handler = _mod.handler
