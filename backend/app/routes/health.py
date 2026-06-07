from flask import Blueprint, jsonify
from sqlalchemy import text

from app.extensions import db, _get_redis


health_bp = Blueprint("health", __name__, url_prefix="/api/v1")


@health_bp.route("/health", methods=["GET"])
def health():
    db_ok = False
    redis_ok = False

    try:
        db.session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    try:
        r = _get_redis()
        if r:
            r.ping()
            redis_ok = True
    except Exception:
        pass

    status_code = 200 if db_ok else 503

    return jsonify({
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "redis": "connected" if redis_ok else "unavailable",
    }), status_code
