import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.services.auth_service import login_user

app = create_app()
with app.app_context():
    pw_hash = hashlib.sha256(b"alice123").hexdigest()
    result = login_user("alice", pw_hash)
    if result:
        print("LOGIN OK")
        print("  token:   " + result["session_token"][:50] + "...")
        print("  t_vers:  " + str(result["t_version"]))
        print("  user_id: " + result["user_id"])
    else:
        print("LOGIN FAILED")
