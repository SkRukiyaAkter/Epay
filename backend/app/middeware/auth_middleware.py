import uuid
from functools import wraps

import jwt as pyjwt
from flask import request, jsonify, g, current_app

from app.models.user import User
from app.models.device_credential import DeviceCredential
from app.models.timestamp_key import TimestampKey
from app.services.audit_service import log_event


def require_jwt(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({"error": "missing_token"}), 401

        try:
            payload = pyjwt.decode(
                token,
                current_app.config["JWT_SECRET"],
                algorithms=["HS256"],
            )
        except pyjwt.ExpiredSignatureError:
            return jsonify({"error": "token_expired"}), 401
        except pyjwt.InvalidTokenError:
            return jsonify({"error": "invalid_token"}), 401

        g.current_user_id = uuid.UUID(payload["user_id"])
        g.current_device_id = uuid.UUID(payload["device_id"])
        g.token_jti = payload.get("jti")

        user = User.query.get(g.current_user_id)
        if not user or user.account_status != "active":
            return jsonify({"error": "account_suspended"}), 403

        g.current_user = user

        return f(*args, **kwargs)

    return decorated


def _extract_token() -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None
