import json
import base64
import os
import time
import hmac as stdlib_hmac
import hashlib

from flask import Blueprint, request, jsonify, g

from app.middeware.auth_middleware import require_jwt
from app.models.user import User
from app.models.device_credential import DeviceCredential
from app.models.timestamp_key import TimestampKey
from app.models.account import Account
from app.services.crypto_service import (
    derive_k1,
    derive_aes_key,
    aes_gcm_decrypt,
    hmac_verify,
    fernet_decrypt,
    hash_sha256,
)

simulate_bp = Blueprint("simulate", __name__, url_prefix="/api/v1/simulate")


def _bytes_to_hex(b: bytes) -> str:
    return b.hex()


@simulate_bp.route("/encrypt", methods=["POST"])
@require_jwt
def encrypt_side():
    """Encryption side: derive all keys, build M, compute HMAC, AES-GCM encrypt."""
    data = request.get_json(force=True)
    receiver_username = data.get("receiver_username", "").strip()
    amount_str = data.get("amount", "")
    currency = data.get("currency", "BDT")

    if not receiver_username or not amount_str:
        return jsonify({"error": "missing_fields"}), 400

    sender = User.query.get(g.current_user_id)
    device = DeviceCredential.query.filter_by(user_id=g.current_user_id).first()
    ts_key = TimestampKey.query.filter_by(user_id=g.current_user_id).first()

    if not device:
        return jsonify({"error": "no_device"}), 400

    start = time.perf_counter()

    k2_raw = fernet_decrypt(device.k2_encrypted)
    session_secret_raw = fernet_decrypt(device.session_secret_encrypted)

    k1 = derive_k1(
        device.activation_code_hash,
        sender.nid_hash,
        device.browser_fingerprint,
    )

    nonce = os.urandom(16).hex()
    m = {
        "sender_username": sender.username,
        "receiver_username": receiver_username,
        "amount": amount_str,
        "currency": currency,
        "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "nonce": nonce,
    }
    m_str = json.dumps(m)

    f1_raw = stdlib_hmac.new(k1, m_str.encode(), hashlib.sha256).digest()
    f1_b64 = base64.b64encode(f1_raw).decode()

    aes_key = derive_aes_key(
        k2_raw.encode(),
        session_secret_raw.encode(),
        ts_key.current_t,
        nonce,
    )

    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    iv = os.urandom(12)
    plaintext = (m_str + "|" + f1_b64).encode()
    aad = (sender.username + str(ts_key.t_version)).encode()
    aesgcm = AESGCM(aes_key)
    ciphertext = aesgcm.encrypt(iv, plaintext, aad)

    encrypted_payload = base64.b64encode(iv + ciphertext).decode()
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

    return jsonify({
        "direction": "encrypt",
        "step_1_message_m": json.dumps(m, indent=2),
        "step_2_k1_hex": _bytes_to_hex(k1),
        "step_3_f1_hex": _bytes_to_hex(f1_raw),
        "step_3_f1_b64": f1_b64,
        "step_4_aes_key_hex": _bytes_to_hex(aes_key),
        "step_4_nonce": nonce,
        "step_4_hkdf_info": "epayment-transaction-v1",
        "step_5_iv_hex": _bytes_to_hex(iv),
        "step_5_aad": sender.username + str(ts_key.t_version),
        "step_5_ciphertext_hex": _bytes_to_hex(ciphertext),
        "step_5_auth_tag_hex": _bytes_to_hex(ciphertext[-16:]),
        "encrypted_payload_b64": encrypted_payload,
        "declared_t_version": ts_key.t_version,
        "t_current_hex": ts_key.current_t[:32] + "...",
        "timing_ms": elapsed_ms,
    }), 200


@simulate_bp.route("/decrypt", methods=["POST"])
@require_jwt
def decrypt_side():
    """Decryption side: take encrypted_payload, decrypt, verify HMAC."""
    data = request.get_json(force=True)
    encrypted_payload = data.get("encrypted_payload", "")
    declared_t_version = data.get("declared_t_version")
    nonce = data.get("nonce")

    if not encrypted_payload:
        return jsonify({"error": "missing_payload"}), 400

    sender = User.query.get(g.current_user_id)
    device = DeviceCredential.query.filter_by(user_id=g.current_user_id).first()
    ts_key = TimestampKey.query.filter_by(user_id=g.current_user_id).first()

    if not device:
        return jsonify({"error": "no_device"}), 400

    start = time.perf_counter()

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
        nonce or "unknown",
    )

    aad = (sender.username + str(ts_key.t_version)).encode()

    try:
        raw = base64.b64decode(encrypted_payload)
        iv, ct = raw[:12], raw[12:]
        plaintext = aes_gcm_decrypt(aes_key, encrypted_payload, aad)
        decryption_success = True
    except Exception:
        plaintext = b""
        decryption_success = False
        iv = b""
        ct = b""

    hmac_result = False
    plain_str = ""
    m_parsed = None
    f1_received_b64 = ""
    f2_hex = ""

    if decryption_success:
        plain_str = plaintext.decode()
        m_str_received, f1_received_b64 = plain_str.rsplit("|", 1)
        try:
            m_parsed = json.loads(m_str_received)
        except json.JSONDecodeError:
            m_parsed = None

        f2_raw = stdlib_hmac.new(k1, m_str_received.encode(), hashlib.sha256).digest()
        f2_hex = _bytes_to_hex(f2_raw)
        hmac_result = hmac_verify(k1, m_str_received.encode(), f1_received_b64)

    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

    return jsonify({
        "direction": "decrypt",
        "step_1_received_payload_b64": encrypted_payload,
        "step_2_k1_recomputed_hex": _bytes_to_hex(k1),
        "step_3_aes_key_hex": _bytes_to_hex(aes_key),
        "step_3_aad": sender.username + str(ts_key.t_version),
        "step_4_iv_hex": _bytes_to_hex(iv),
        "step_4_ciphertext_hex": _bytes_to_hex(ct),
        "step_5_decryption_success": decryption_success,
        "step_6_plaintext": plain_str[:512] if plain_str else "",
        "step_7_hmac_f1_received_hex": _bytes_to_hex(base64.b64decode(f1_received_b64)) if f1_received_b64 else "",
        "step_7_hmac_f2_computed_hex": f2_hex,
        "step_7_hmac_match": hmac_result,
        "step_7_message_parsed": json.dumps(m_parsed, indent=2) if m_parsed else "{}",
        "timing_ms": elapsed_ms,
    }), 200
