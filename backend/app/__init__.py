from flask import Flask
from flask_migrate import Migrate
from app.extensions import db
from config import Config

migrate = Migrate()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)

    with app.app_context():
        from app.models import (
            user,
            account,
            device_credential,
            timestamp_key,
            transaction,
            audit_log,
            tls_certificate,
        )

    from app.routes.auth import auth_bp
    from app.routes.transaction import transaction_bp
    from app.routes.account import account_bp
    from app.routes.device import device_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(transaction_bp)
    app.register_blueprint(account_bp)
    app.register_blueprint(device_bp)

    return app
