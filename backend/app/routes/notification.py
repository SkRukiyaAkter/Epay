from flask import Blueprint, request, jsonify, g
from app.middeware.auth_middleware import require_jwt
from app.models.notification import Notification
from app.extensions import db

notification_bp = Blueprint("notification", __name__, url_prefix="/api/v1/notification")


@notification_bp.route("/list", methods=["GET"])
@require_jwt
def list_notifications():
    limit = request.args.get("limit", 20, type=int)
    offset = request.args.get("offset", 0, type=int)

    query = Notification.query.filter_by(user_id=g.current_user_id)
    total_unread = query.filter_by(is_read=False).count()
    notifications = (
        query.order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [
        {
            "id": str(n.id),
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "metadata": n.metadata_json,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]

    return jsonify({"notifications": items, "total_unread": total_unread}), 200


@notification_bp.route("/unread-count", methods=["GET"])
@require_jwt
def unread_count():
    count = Notification.query.filter_by(
        user_id=g.current_user_id, is_read=False
    ).count()
    return jsonify({"unread_count": count}), 200


@notification_bp.route("/read", methods=["POST"])
@require_jwt
def mark_read():
    data = request.get_json(silent=True) or {}
    notification_id = data.get("notification_id")
    mark_all = data.get("mark_all", False)

    if mark_all:
        Notification.query.filter_by(
            user_id=g.current_user_id, is_read=False
        ).update({"is_read": True})
    elif notification_id:
        Notification.query.filter_by(
            id=notification_id, user_id=g.current_user_id
        ).update({"is_read": True})
    else:
        return jsonify({"error": "missing_notification_id"}), 400

    db.session.commit()
    return jsonify({"read": True}), 200


def create_notification(user_id, type, title, message, metadata=None):
    try:
        n = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            metadata_json=metadata,
        )
        db.session.add(n)
        db.session.commit()
    except Exception:
        db.session.rollback()
