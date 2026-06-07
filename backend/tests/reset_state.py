"""Reset database to initial seed state for testing."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.extensions import db

app = create_app()
with app.app_context():
    db.session.execute(
        db.text("UPDATE users SET account_status='active' WHERE username='alice'")
    )
    db.session.execute(
        db.text("UPDATE device_credentials SET is_active=true WHERE user_id=(SELECT user_id FROM users WHERE username='alice')")
    )
    db.session.execute(
        db.text("UPDATE accounts SET balance=10000, daily_used=0 WHERE user_id=(SELECT user_id FROM users WHERE username='alice')")
    )
    db.session.execute(
        db.text("UPDATE accounts SET balance=5000 WHERE user_id=(SELECT user_id FROM users WHERE username='bob')")
    )
    db.session.execute(
        db.text("DELETE FROM transactions WHERE sender_id=(SELECT user_id FROM users WHERE username='alice')")
    )
    db.session.commit()
    print("Database reset complete")
