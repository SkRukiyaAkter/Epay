from flask import Flask
from flask_migrate import Migrate
from app.extensions import db
from config import Config

migrate = Migrate()


def create_app(config_class=Config):
    config_class.validate()
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
            notification,
        )

    from app.routes.auth import auth_bp
    from app.routes.transaction import transaction_bp
    from app.routes.account import account_bp
    from app.routes.device import device_bp
    from app.routes.health import health_bp
    from app.routes.notification import notification_bp
    from app.routes.simulate import simulate_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(transaction_bp)
    app.register_blueprint(account_bp)
    app.register_blueprint(device_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(notification_bp)
    app.register_blueprint(simulate_bp)

    return app
