import uuid
from datetime import datetime, timezone
from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = db.Column(db.String(64), unique=True, nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    nid_hash = db.Column(db.String(128), unique=True, nullable=False)
    email = db.Column(db.String(255))
    password_hash = db.Column(db.String(128), nullable=False, default="")
    account_status = db.Column(db.String(20), nullable=False, default="active")
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    account = db.relationship("Account", back_populates="user", uselist=False)
    device_credential = db.relationship(
        "DeviceCredential", back_populates="user", uselist=False
    )
    timestamp_key = db.relationship(
        "TimestampKey", back_populates="user", uselist=False
    )
