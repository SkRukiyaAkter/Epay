from flask import Blueprint, request, jsonify, g

from app.middeware.auth_middleware import require_jwt
from app.services import transaction_service
from app.models.transaction import Transaction
from app.models.user import User

transaction_bp = Blueprint("transaction", __name__, url_prefix="/api/v1/transaction")


@transaction_bp.route("/initiate", methods=["POST"])
@require_jwt
def initiate():
    data = request.get_json(force=True)

    encrypted_payload = data.get("encrypted_payload", "")
    nonce = data.get("nonce", "")
    declared_t_version = data.get("t_version")
    device_id = data.get("device_id", "")

    if not encrypted_payload or not nonce or declared_t_version is None:
        return jsonify({"error": "missing_fields"}), 400

    result = transaction_service.process(
        encrypted_payload=encrypted_payload,
        nonce=nonce,
        declared_t_version=int(declared_t_version),
        device_id=device_id,
        sender_user_id=str(g.current_user_id),
        ip_address=request.remote_addr,
        tls_session_id=request.headers.get("X-TLS-Session-ID"),
    )

    status_code = 200 if result["status"] == "completed" else 400
    return jsonify(result), status_code


@transaction_bp.route("/history", methods=["GET"])
@require_jwt
def history():
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)

    user_id = g.current_user_id

    base = Transaction.query.filter(
        (Transaction.sender_id == user_id) | (Transaction.receiver_id == user_id)
    ).order_by(Transaction.initiated_at.desc())

    total = base.count()
    txns = base.offset((page - 1) * limit).limit(limit).all()

    result = []
    for t in txns:
        is_sent = t.sender_id == user_id
        counterparty = User.query.get(t.receiver_id if is_sent else t.sender_id)
        result.append({
            "transaction_id": str(t.transaction_id),
            "direction": "sent" if is_sent else "received",
            "counterparty_username": counterparty.username if counterparty else "unknown",
            "amount": str(t.amount),
            "currency": t.currency,
            "status": t.status,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        })

    return jsonify({
        "transactions": result,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if total > 0 else 1,
    }), 200


@transaction_bp.route("/<transaction_id>", methods=["GET"])
@require_jwt
def detail(transaction_id):
    from uuid import UUID
    t = Transaction.query.filter_by(transaction_id=UUID(transaction_id)).first()
    if not t:
        return jsonify({"error": "not_found"}), 404

    uid = g.current_user_id
    if t.sender_id != uid and t.receiver_id != uid:
        return jsonify({"error": "forbidden"}), 403

    sender = User.query.get(t.sender_id)
    receiver = User.query.get(t.receiver_id)

    return jsonify({
        "transaction_id": str(t.transaction_id),
        "sender_username": sender.username if sender else "unknown",
        "receiver_username": receiver.username if receiver else "unknown",
        "amount": str(t.amount),
        "currency": t.currency,
        "status": t.status,
        "failure_reason": t.failure_reason,
        "hmac_verified": t.hmac_verified,
        "initiated_at": t.initiated_at.isoformat() if t.initiated_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
    }), 200
