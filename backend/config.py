import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env", override=True)


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = os.environ.get("JWT_SECRET", "")
    SERVER_HMAC_SECRET = os.environ.get("SERVER_HMAC_SECRET", "")
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    OFFICER_API_KEY = os.environ.get("OFFICER_API_KEY", "")

    @staticmethod
    def validate():
        required = {
            "SECRET_KEY": Config.SECRET_KEY,
            "DATABASE_URL": Config.SQLALCHEMY_DATABASE_URI,
            "JWT_SECRET": Config.JWT_SECRET,
            "SERVER_HMAC_SECRET": Config.SERVER_HMAC_SECRET,
            "OFFICER_API_KEY": Config.OFFICER_API_KEY,
        }
        missing = [k for k, v in required.items() if not v]
        if missing:
            raise RuntimeError(f"Missing required config keys: {', '.join(missing)}. Check your .env file.")
