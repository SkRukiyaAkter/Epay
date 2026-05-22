import hashlib
import hmac
import os


def derive_k1(activation_code: str, nid_number: str, browser_fingerprint: str) -> bytes:
    nid_hash = hashlib.sha256(nid_number.encode()).digest()
    fp_hash = hashlib.sha256(browser_fingerprint.encode()).digest()
    msg = nid_hash + fp_hash
    k1 = hmac.new(activation_code.encode(), msg, hashlib.sha256).digest()
    return k1


def derive_initial_t(user_id: str) -> str:
    msg = user_id.encode() + os.urandom(32)
    server_secret = os.environ.get("SERVER_HMAC_SECRET", "dev-hmac-secret").encode()
    return hmac.new(server_secret, msg, hashlib.sha256).hexdigest()


def hash_sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
