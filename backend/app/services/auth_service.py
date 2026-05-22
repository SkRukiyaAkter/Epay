import hashlib
import os
from decimal import Decimal
from datetime import datetime, timezone

from app.extensions import db
from app.models.user import User
from app.models.account import Account
from app.models.device_credential import DeviceCredential
from app.models.timestamp_key import TimestampKey
from app.services.crypto_service import derive_k1, derive_initial_t, hash_sha256


def register_user(
    full_name: str,
    nid_number: str,
    browser_fingerprint: str,
    password: str,
    activation_code: str = "seed-activation",
    daily_limit: Decimal = Decimal("5000.00"),
    balance: Decimal = Decimal("0.00"),
    email: str | None = None,
) -> tuple[User, Account]:
    now = datetime.now(timezone.utc)
    nid_hash = hash_sha256(nid_number)
    fp_hash = hash_sha256(browser_fingerprint)
    k1 = derive_k1(activation_code, nid_number, browser_fingerprint)
    k1_hash = hash_sha256(k1.hex())
    session_secret = os.urandom(32).hex()
    session_secret_hash = hash_sha256(session_secret)
    activation_code_hash = hash_sha256(activation_code)
    password_hash = hashlib.sha256(password.encode()).hexdigest()

    user = User(
        username=nid_number[:12],
        full_name=full_name,
        nid_hash=nid_hash,
        email=email,
        account_status="active",
        created_at=now,
        updated_at=now,
    )
    db.session.add(user)
    db.session.flush()

    account = Account(
        user_id=user.user_id,
        balance=balance,
        daily_limit=daily_limit,
        daily_used=Decimal("0.00"),
        daily_reset_at=now.date(),
        currency="BDT",
        created_at=now,
        updated_at=now,
    )
    db.session.add(account)
    db.session.flush()

    device = DeviceCredential(
        user_id=user.user_id,
        browser_fingerprint=fp_hash,
        k1_hash=k1_hash,
        session_secret_hash=session_secret_hash,
        activation_code_hash=activation_code_hash,
        is_active=True,
        registered_at=now,
        last_used_at=now,
    )
    db.session.add(device)
    db.session.flush()

    t_current = derive_initial_t(str(user.user_id))
    ts_key = TimestampKey(
        user_id=user.user_id,
        current_t=t_current,
        t_version=1,
        last_updated_at=now,
    )
    db.session.add(ts_key)
    db.session.flush()

    db.session.commit()
    return user, account
