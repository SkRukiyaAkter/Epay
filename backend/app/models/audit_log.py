import uuid
from datetime import datetime, timezone
from app.extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_log"

    log_id = db.Column(
        db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("users.user_id")
    )
    device_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("device_credentials.device_id"),
    )
    event_type = db.Column(db.String(64), nullable=False)
    event_detail = db.Column(db.JSON)
    ip_address = db.Column(db.String(45))
    tls_session_id = db.Column(db.String(128))
    occurred_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
