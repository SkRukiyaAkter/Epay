import hashlib
import hmac as stdlib_hmac
import os
import base64
from decimal import Decimal

from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.fernet import Fernet
from flask import current_app


def _get_server_hmac_secret() -> bytes:
    secret = current_app.config.get("SERVER_HMAC_SECRET", "dev-hmac-secret")
    return secret.encode() if isinstance(secret, str) else secret


def _get_fernet() -> Fernet:
    key = hashlib.sha256(current_app.config["SECRET_KEY"].encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def fernet_encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def fernet_decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()


def derive_k1(activation_code: str, nid_number: str, browser_fingerprint: str) -> bytes:
    nid_hash = hashlib.sha256(nid_number.encode()).digest()
    fp_hash = hashlib.sha256(browser_fingerprint.encode()).digest()
    msg = nid_hash + fp_hash
    return stdlib_hmac.new(activation_code.encode(), msg, hashlib.sha256).digest()


def derive_aes_key(k2: bytes, session_secret: bytes, t_current: str, nonce: str) -> bytes:
    ikm = k2 + session_secret + t_current.encode()
    salt = nonce.encode()[:32].ljust(32, b"\x00")
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"epayment-transaction-v1",
    )
    return hkdf.derive(ikm)


def aes_gcm_decrypt(aes_key: bytes, encrypted_payload_b64: str, aad: bytes) -> bytes:
    raw = base64.b64decode(encrypted_payload_b64)
    iv, ciphertext = raw[:12], raw[12:]
    aesgcm = AESGCM(aes_key)
    return aesgcm.decrypt(iv, ciphertext, aad)


def hmac_verify(k1: bytes, message: bytes, expected_f1_b64: str) -> bool:
    expected_f1 = base64.b64decode(expected_f1_b64)
    computed = stdlib_hmac.new(k1, message, hashlib.sha256).digest()
    return stdlib_hmac.compare_digest(computed, expected_f1)


def derive_next_t(t_old: str, t_version_new: int, transaction_id: str) -> str:
    server_secret = _get_server_hmac_secret()
    msg = (
        t_old.encode()
        + str(t_version_new).encode()
        + hashlib.sha256(transaction_id.encode()).digest()
    )
    return stdlib_hmac.new(server_secret, msg, hashlib.sha256).hexdigest()


def derive_initial_t(user_id: str) -> str:
    server_secret = _get_server_hmac_secret()
    msg = user_id.encode() + os.urandom(32)
    return stdlib_hmac.new(server_secret, msg, hashlib.sha256).hexdigest()


def hash_sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
