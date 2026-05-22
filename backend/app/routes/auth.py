import hashlib

from flask import Blueprint, request, jsonify

from app.services import auth_service

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    password_hash = data.get("password_hash", "")

    if not username or not password_hash:
        return jsonify({"error": "missing_fields"}), 400

    result = auth_service.login_user(username, password_hash)
    if not result:
        return jsonify({"error": "invalid_credentials"}), 401

    return jsonify(result), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    return jsonify({"logged_out": True}), 200


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    return jsonify({"error": "not_implemented"}), 501
