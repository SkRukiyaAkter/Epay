import time
from functools import wraps
from flask import request, jsonify

from app.extensions import _get_redis


def rate_limit(max_requests: int = 30, window_seconds: int = 60):
    """Per-IP rate limiting with Redis backend and in-memory fallback."""

    _in_memory_log = {}

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.remote_addr or "unknown"
            key = f"rate:{request.endpoint}:{ip}"
            now = time.time()

            r = _get_redis()
            if r:
                window_start = now - window_seconds
                pipe = r.pipeline()
                pipe.zremrangebyscore(key, 0, window_start)
                pipe.zcard(key)
                pipe.zadd(key, {str(now): now})
                pipe.expire(key, window_seconds + 1)
                _, count, _, _ = pipe.execute()
                if count >= max_requests:
                    return jsonify({"error": "rate_limit_exceeded"}), 429
            else:
                timestamps = _in_memory_log.get(key, [])
                timestamps = [t for t in timestamps if now - t < window_seconds]
                _in_memory_log[key] = timestamps
                if len(timestamps) >= max_requests:
                    return jsonify({"error": "rate_limit_exceeded"}), 429
                timestamps.append(now)

            return f(*args, **kwargs)
        return wrapped
    return decorator
