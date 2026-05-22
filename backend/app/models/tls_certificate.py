import uuid
from datetime import datetime, timezone
from app.extensions import db


class TlsCertificate(db.Model):
    __tablename__ = "tls_certificates"

    cert_id = db.Column(
        db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    device_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("device_credentials.device_id"),
        nullable=False,
    )
    serial_number = db.Column(db.String(128), unique=True, nullable=False)
    issued_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked = db.Column(db.Boolean, nullable=False, default=False)
    revoked_at = db.Column(db.DateTime(timezone=True))
    revocation_reason = db.Column(db.String(128))
