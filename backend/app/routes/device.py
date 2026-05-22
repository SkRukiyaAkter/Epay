from flask import Blueprint, jsonify, g

from app.middeware.auth_middleware import require_jwt
from app.models.device_credential import DeviceCredential

device_bp = Blueprint("device", __name__, url_prefix="/api/v1/device")


@device_bp.route("/status", methods=["GET"])
@require_jwt
def status():
    device = DeviceCredential.query.filter_by(user_id=g.current_user_id).first()
    if not device:
        return jsonify({"error": "not_found"}), 404

    return jsonify({
        "device_id": str(device.device_id),
        "is_active": device.is_active,
        "registered_at": device.registered_at.isoformat() if device.registered_at else None,
        "last_used_at": device.last_used_at.isoformat() if device.last_used_at else None,
    }), 200


@device_bp.route("/revoke-certificate", methods=["POST"])
@require_jwt
def revoke_certificate():
    return jsonify({"message": "noop_mvp"}), 200
