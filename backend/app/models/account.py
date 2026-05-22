import uuid
from decimal import Decimal
from datetime import date, datetime, timezone
from app.extensions import db


class Account(db.Model):
    __tablename__ = "accounts"

    account_id = db.Column(
        db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.user_id"),
        unique=True,
        nullable=False,
    )
    balance = db.Column(
        db.Numeric(15, 2), nullable=False, default=Decimal("0.00")
    )
    daily_limit = db.Column(
        db.Numeric(15, 2), nullable=False, default=Decimal("5000.00")
    )
    daily_used = db.Column(
        db.Numeric(15, 2), nullable=False, default=Decimal("0.00")
    )
    daily_reset_at = db.Column(db.Date, nullable=False, default=date.today)
    currency = db.Column(db.String(3), nullable=False, default="BDT")
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", back_populates="account")
