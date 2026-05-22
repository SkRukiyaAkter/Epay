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
        from app.models import user, account, device_credential, timestamp_key, transaction, audit_log, tls_certificate

    return app
