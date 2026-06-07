import json
from datetime import date, datetime, timezone
from decimal import Decimal

from flask import current_app

from app.extensions import db
from app.models.user import User
from app.models.account import Account
from app.models.device_credential import DeviceCredential
from app.models.timestamp_key import TimestampKey
from app.models.transaction import Transaction
from app.services.crypto_service import (
    derive_k1,
    derive_aes_key,
    aes_gcm_decrypt,
    hmac_verify,
    derive_next_t,
    fernet_decrypt,
    hash_sha256,
)
from app.services import audit_service


FAIL_REASONS = {
    "account_suspended",
    "replay_detected",
    "decryption_failed",
    "hmac_mismatch",
    "receiver_not_found",
    "insufficient_funds",
    "daily_limit_exceeded",
}


def _fail(reason: str) -> dict:
    return {
        "transaction_id": None,
        "status": "failed",
        "reason": reason,
    }


def process(
    encrypted_payload: str,
    nonce: str,
    declared_t_version: int,
    device_id: str,
    sender_user_id: str,
    ip_address: str | None = None,
    tls_session_id: str | None = None,
) -> dict:
    sender = User.query.get(sender_user_id)
    if not sender:
        return _fail("account_suspended")

    device = DeviceCredential.query.filter_by(
        user_id=sender_user_id
    ).first()
    if not device or not device.is_active:
        audit_service.log_event(
            "device_inactive",
            user_id=sender_user_id,
        )
        return _fail("account_suspended")

    if sender.account_status != "active":
        audit_service.log_event(
            "account_suspended",
            user_id=sender_user_id,
            event_detail={"status": sender.account_status},
        )
        return _fail("account_suspended")

    ts_key = TimestampKey.query.filter_by(
        user_id=sender_user_id
    ).with_for_update().first()
    if not ts_key:
        return _fail("account_suspended")

    if ts_key.t_version != declared_t_version:
        audit_service.log_event(
            "replay_detected",
            user_id=sender_user_id,
            event_detail={
                "declared": declared_t_version,
                "expected": ts_key.t_version,
            },
        )
        return _fail("replay_detected")

    account = Account.query.filter_by(
        user_id=sender_user_id
    ).with_for_update().first()
    if not account:
        return _fail("account_suspended")

    k2_raw = fernet_decrypt(device.k2_encrypted)
    session_secret_raw = fernet_decrypt(device.session_secret_encrypted)
    k1 = derive_k1(
        device.activation_code_hash,
        sender.nid_hash,
        device.browser_fingerprint,
    )

    aes_key = derive_aes_key(
        k2_raw.encode(),
        session_secret_raw.encode(),
        ts_key.current_t,
        nonce,
    )
    aad = (sender.username + str(declared_t_version)).encode()

    try:
        plaintext = aes_gcm_decrypt(aes_key, encrypted_payload, aad)
    except Exception:
        audit_service.log_event(
            "decryption_failed",
            user_id=sender_user_id,
            device_id=device.device_id,
        )
        return _fail("decryption_failed")

    plain_str = plaintext.decode()
    m_str, f1_b64 = plain_str.rsplit("|", 1)
    try:
        m = json.loads(m_str)
    except json.JSONDecodeError:
        return _fail("decryption_failed")

    if not hmac_verify(k1, m_str.encode(), f1_b64):
        audit_service.log_event(
            "hmac_mismatch",
            user_id=sender_user_id,
            device_id=device.device_id,
        )
        return _fail("hmac_mismatch")

    amount = Decimal(str(m["amount"]))
    receiver = User.query.filter_by(
        username=m["receiver_username"]
    ).first()
    if not receiver:
        return _fail("receiver_not_found")

    if account.daily_reset_at < date.today():
        account.daily_used = Decimal("0.00")
        account.daily_reset_at = date.today()

    if account.balance < amount:
        return _fail("insufficient_funds")

    if account.daily_used + amount > account.daily_limit:
        return _fail("daily_limit_exceeded")

    receiver_account = Account.query.filter_by(
        user_id=receiver.user_id
    ).with_for_update().first()
    if not receiver_account:
        return _fail("receiver_not_found")

    txn = Transaction(
        sender_id=sender.user_id,
        receiver_id=receiver.user_id,
        amount=amount,
        currency=m.get("currency", "BDT"),
        status="pending",
        hmac_verified=True,
        t_version_used=declared_t_version,
        ip_address=ip_address,
        tls_session_id=tls_session_id,
        device_id=device.device_id,
    )
    db.session.add(txn)
    db.session.flush()

    account.balance -= amount
    account.daily_used += amount
    receiver_account.balance += amount
    txn.status = "completed"
    txn.completed_at = datetime.now(timezone.utc)

    new_t = derive_next_t(
        ts_key.current_t,
        ts_key.t_version + 1,
        str(txn.transaction_id),
    )
    ts_key.current_t = new_t
    ts_key.t_version += 1
    ts_key.last_updated_at = datetime.now(timezone.utc)

    db.session.commit()

    audit_service.log_event(
        "transaction_completed",
        user_id=sender_user_id,
        device_id=device.device_id,
        event_detail={
            "transaction_id": str(txn.transaction_id),
            "amount": str(amount),
            "receiver": receiver.username,
        },
    )

    from app.routes.notification import create_notification
    create_notification(
        user_id=receiver.user_id,
        type="transaction_received",
        title="Money Received",
        message=f"You received {amount} {m.get('currency', 'BDT')} from {sender.username}",
        metadata={
            "transaction_id": str(txn.transaction_id),
            "amount": str(amount),
            "sender": sender.username,
        },
    )

    return {
        "transaction_id": str(txn.transaction_id),
        "status": "completed",
        "sender_new_balance": str(account.balance),
        "t_next": new_t,
        "t_version_next": ts_key.t_version,
        "completed_at": txn.completed_at.isoformat(),
    }
