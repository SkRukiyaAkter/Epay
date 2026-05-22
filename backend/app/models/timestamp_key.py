import uuid
from datetime import datetime, timezone
from app.extensions import db


class TimestampKey(db.Model):
    __tablename__ = "timestamp_keys"

    ts_key_id = db.Column(
        db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.user_id"),
        unique=True,
        nullable=False,
    )
    current_t = db.Column(db.String(256), nullable=False)
    t_version = db.Column(db.BigInteger, nullable=False, default=1)
    last_updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", back_populates="timestamp_key")
