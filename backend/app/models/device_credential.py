import uuid
from datetime import datetime, timezone
from app.extensions import db


class DeviceCredential(db.Model):
    __tablename__ = "device_credentials"

    device_id = db.Column(
        db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.user_id"),
        unique=True,
        nullable=False,
    )
    browser_fingerprint = db.Column(db.String(128), nullable=False)
    k1_hash = db.Column(db.String(128), nullable=False)
    session_secret_hash = db.Column(db.String(128), nullable=False)
    activation_code_hash = db.Column(db.String(128), nullable=False)
    k2_encrypted = db.Column(db.Text)
    session_secret_encrypted = db.Column(db.Text)
    tls_client_cert_pem = db.Column(db.Text)
    tls_cert_serial = db.Column(db.String(128))
    tls_cert_expires_at = db.Column(db.DateTime(timezone=True))
    app_version = db.Column(db.String(32))
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    registered_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    last_used_at = db.Column(db.DateTime(timezone=True))

    user = db.relationship("User", back_populates="device_credential")
