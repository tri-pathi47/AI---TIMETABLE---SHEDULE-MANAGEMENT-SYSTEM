import os


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "my_secret_key"

    _database_url = os.environ.get("DATABASE_URL", "sqlite:///database.db")

    if _database_url.startswith("postgres://"):
        _database_url = _database_url.replace(
            "postgres://",
            "postgresql://",
            1
        )

    SQLALCHEMY_DATABASE_URI = _database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = (
        os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
    )