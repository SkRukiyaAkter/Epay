from flask import Blueprint, jsonify, g

from app.middeware.auth_middleware import require_jwt
from app.extensions import blacklist_user_tokens
from app.models.account import Account

account_bp = Blueprint("account", __name__, url_prefix="/api/v1/account")


@account_bp.route("/balance", methods=["GET"])
@require_jwt
def balance():
    account = Account.query.filter_by(user_id=g.current_user_id).first()
    if not account:
        return jsonify({"error": "not_found"}), 404

    return jsonify({
        "balance": str(account.balance),
        "currency": account.currency,
        "daily_limit": str(account.daily_limit),
        "daily_used": str(account.daily_used),
        "daily_remaining": str(account.daily_limit - account.daily_used),
    }), 200


@account_bp.route("/suspend", methods=["POST"])
@require_jwt
def suspend():
    from app.extensions import db
    from app.models.user import User

    user = User.query.get(g.current_user_id)
    if not user:
        return jsonify({"error": "not_found"}), 404

    user.account_status = "suspended"
    device = db.session.query(type(user).device_credential.property.mapper.class_).filter_by(
        user_id=user.user_id
    ).first()
    if device:
        device.is_active = False

    db.session.commit()

    # Blacklist all active tokens for this user (15-minute window)
    blacklist_user_tokens(str(user.user_id), ttl_seconds=900)

    from app.services.audit_service import log_event
    log_event("account_suspended", user_id=str(user.user_id))

    return jsonify({"suspended": True}), 200
