import hashlib

from flask import Blueprint, request, jsonify, g

from app.middeware.auth_middleware import require_jwt, require_officer_key
from app.middeware.rate_limit import rate_limit
from app.services import auth_service
from app.services.crypto_service import hash_sha256
from app.extensions import blacklist_jti, blacklist_user_tokens
from app.services.audit_service import log_event

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.route("/register", methods=["POST"])
@require_officer_key
def register():
    data = request.get_json(force=True)

    full_name = data.get("full_name", "").strip()
    nid_number = data.get("nid_number", "").strip()
    phone_number = data.get("phone_number", "").strip()
    email = data.get("email")
    user_agent = request.headers.get("User-Agent", "unknown")
    accept_lang = request.headers.get("Accept-Language", "unknown")
    browser_fingerprint = hash_sha256(user_agent + accept_lang)
    session_secret_hash = data.get("session_secret_hash", "").strip()
    daily_limit = data.get("daily_limit", 5000.00)
    activation_code = data.get("activation_code", "").strip()
    password = data.get("password", "").strip()

    if not full_name or not nid_number or not password:
        return jsonify({"error": "missing_fields"}), 400

    existing = auth_service.User.query.filter_by(username=nid_number[:12]).first()
    if existing:
        return jsonify({"error": "user_already_exists"}), 409

    try:
        from decimal import Decimal
        user, account = auth_service.register_user(
            full_name=full_name,
            nid_number=nid_number,
            browser_fingerprint=browser_fingerprint,
            password=password,
            activation_code=activation_code or "officer-activation",
            daily_limit=Decimal(str(daily_limit)),
            email=email,
        )
        return jsonify({
            "user_id": str(user.user_id),
            "username": user.username,
            "account_id": str(account.account_id),
            "registration_status": "success",
        }), 201
    except Exception as e:
        from app.extensions import db
        db.session.rollback()
        log_event("registration_failed", event_detail={"error": str(e)})
        return jsonify({"error": "registration_failed", "detail": str(e)}), 500


@auth_bp.route("/login", methods=["POST"])
@rate_limit(max_requests=10, window_seconds=60)
def login():
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"error": "missing_fields"}), 400

    result = auth_service.login_user(username, password)
    if not result:
        return jsonify({"error": "invalid_credentials"}), 401

    return jsonify(result), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    return jsonify({"logged_out": True}), 200


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    return jsonify({"error": "not_implemented"}), 501
