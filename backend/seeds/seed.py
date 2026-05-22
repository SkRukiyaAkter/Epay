"""Seed the database with test users for development/demo.

Usage:
    python seeds/seed.py

Idempotent: skips users whose username already exists.
"""

import sys
import os
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models.user import User
from app.services import auth_service

SEED_USERS = [
    {
        "username": "alice",
        "full_name": "Alice Rahman",
        "nid_number": "1234567890",
        "password": "alice123",
        "browser_fingerprint": "seed_fp_alice_v1",
        "balance": Decimal("10000.00"),
        "daily_limit": Decimal("5000.00"),
        "email": "alice@example.com",
    },
    {
        "username": "bob",
        "full_name": "Bob Hossain",
        "nid_number": "0987654321",
        "password": "bob456",
        "browser_fingerprint": "seed_fp_bob_v1",
        "balance": Decimal("5000.00"),
        "daily_limit": Decimal("3000.00"),
        "email": "bob@example.com",
    },
]


def seed():
    app = create_app()
    with app.app_context():
        for data in SEED_USERS:
            existing = User.query.filter_by(username=data["username"]).first()
            if existing:
                print(f"SKIP  {data['username']} — already exists")
                continue

            user, account = auth_service.register_user(
                full_name=data["full_name"],
                nid_number=data["nid_number"],
                browser_fingerprint=data["browser_fingerprint"],
                password=data["password"],
                balance=data["balance"],
                daily_limit=data["daily_limit"],
                email=data.get("email"),
            )

            user.username = data["username"]
            db.session.commit()

            print(f"OK    {data['username']} — balance={data['balance']} BDT")


if __name__ == "__main__":
    seed()
