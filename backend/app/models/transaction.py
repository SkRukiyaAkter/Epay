import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import CheckConstraint
from app.extensions import db


class Transaction(db.Model):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_amount_positive"),
    )

    transaction_id = db.Column(
        db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sender_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.user_id"),
        nullable=False,
    )
    receiver_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.user_id"),
        nullable=False,
    )
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="BDT")
    status = db.Column(db.String(20), nullable=False, default="pending")
    failure_reason = db.Column(db.Text)
    hmac_verified = db.Column(db.Boolean, nullable=False, default=False)
    t_version_used = db.Column(db.BigInteger, nullable=False)
    initiated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = db.Column(db.DateTime(timezone=True))
    tls_session_id = db.Column(db.String(128))
    ip_address = db.Column(db.String(45))
    device_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("device_credentials.device_id"),
    )

    sender = db.relationship("User", foreign_keys=[sender_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])
