from datetime import datetime, timezone

from app.extensions import db
from app.models.audit_log import AuditLog


def log_event(
    event_type: str,
    user_id: str | None = None,
    device_id: str | None = None,
    event_detail: dict | None = None,
    ip_address: str | None = None,
    tls_session_id: str | None = None,
) -> None:
    log = AuditLog(
        user_id=user_id,
        device_id=device_id,
        event_type=event_type,
        event_detail=event_detail,
        ip_address=ip_address,
        tls_session_id=tls_session_id,
        occurred_at=datetime.now(timezone.utc),
    )
    db.session.add(log)
    db.session.commit()
