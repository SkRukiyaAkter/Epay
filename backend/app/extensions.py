import os
import time

from flask_sqlalchemy import SQLAlchemy

# Token blacklist storage — in-memory fallback when Redis is unavailable
_in_memory_blacklist = {}

db = SQLAlchemy()


def _get_redis():
    try:
        import redis
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        client = redis.from_url(redis_url, socket_connect_timeout=2, decode_responses=True)
        client.ping()
        return client
    except Exception:
        return None


def blacklist_jti(jti: str, ttl_seconds: int) -> None:
    r = _get_redis()
    if r:
        r.setex(f"jwt_blacklist:{jti}", ttl_seconds, "1")
    else:
        _in_memory_blacklist[jti] = time.time() + ttl_seconds


def is_jti_blacklisted(jti: str) -> bool:
    r = _get_redis()
    if r:
        return r.exists(f"jwt_blacklist:{jti}") > 0
    else:
        expiry = _in_memory_blacklist.get(jti, 0)
        if time.time() > expiry:
            _in_memory_blacklist.pop(jti, None)
            return False
        return True


def blacklist_user_tokens(user_id: str, ttl_seconds: int = 900) -> None:
    r = _get_redis()
    if r:
        r.setex(f"user_blacklist:{user_id}", ttl_seconds, "1")
    else:
        _in_memory_blacklist[f"user:{user_id}"] = time.time() + ttl_seconds


def is_user_blacklisted(user_id: str) -> bool:
    r = _get_redis()
    if r:
        return r.exists(f"user_blacklist:{user_id}") > 0
    else:
        expiry = _in_memory_blacklist.get(f"user:{user_id}", 0)
        if time.time() > expiry:
            _in_memory_blacklist.pop(f"user:{user_id}", None)
            return False
        return True
