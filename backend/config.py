import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/epayment",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret")
    SERVER_HMAC_SECRET = os.getenv("SERVER_HMAC_SECRET", "dev-hmac-secret")
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
