import hashlib
import uuid
import os
from decimal import Decimal
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
from flask import current_app

from app.extensions import db
from app.models.user import User
from app.models.account import Account
from app.models.device_credential import DeviceCredential
from app.models.timestamp_key import TimestampKey
from app.services.crypto_service import (
    derive_k1,
    derive_initial_t,
    hash_sha256,
    fernet_encrypt,
    fernet_decrypt,
)


def _make_jwt(user_id: uuid.UUID, device_id: uuid.UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": str(user_id),
        "device_id": str(device_id),
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=15),
    }
    return pyjwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def login_user(username: str, password_hash: str) -> dict | None:
    user = User.query.filter_by(username=username).first()
    if not user:
        return None

    if user.password_hash != password_hash:
        return None

    device = DeviceCredential.query.filter_by(user_id=user.user_id).first()
    if not device or not device.is_active:
        return None

    ts_key = TimestampKey.query.filter_by(user_id=user.user_id).first()
    if not ts_key:
        return None

    token = _make_jwt(user.user_id, device.device_id)

    result = {
        "session_token": token,
        "t_current": ts_key.current_t,
        "t_version": ts_key.t_version,
        "user_id": str(user.user_id),
        "device_id": str(device.device_id),
    }

    if device.k2_encrypted and device.session_secret_encrypted:
        result["k2_encrypted"] = device.k2_encrypted
        result["session_secret_encrypted"] = device.session_secret_encrypted

    return result


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
    password_hashed = hash_sha256(password)

    k2_encrypted = fernet_encrypt(password)
    session_secret_encrypted = fernet_encrypt(session_secret)

    user = User(
        username=nid_number[:12],
        full_name=full_name,
        nid_hash=nid_hash,
        email=email,
        password_hash=password_hashed,
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
        k2_encrypted=k2_encrypted,
        session_secret_encrypted=session_secret_encrypted,
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
