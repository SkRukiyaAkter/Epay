import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.device_credential import DeviceCredential
from app.services.crypto_service import fernet_encrypt

app = create_app()
with app.app_context():
    mapping = {"alice": "alice123", "bob": "bob456"}
    for username, pw in mapping.items():
        user = User.query.filter_by(username=username).first()
        if not user:
            continue
        device = DeviceCredential.query.filter_by(user_id=user.user_id).first()
        if not device:
            continue
        if not device.k2_encrypted:
            device.k2_encrypted = fernet_encrypt(pw)
        if not device.session_secret_encrypted:
            device.session_secret_encrypted = fernet_encrypt(f"seed-secret-{username}")
        print(f"Updated {username}")
    db.session.commit()
    print("Done")
