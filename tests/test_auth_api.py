import os

from app import create_app
from app.extensions import db


def test_register_and_login_with_json_payloads():
    os.environ["SECRET_KEY"] = "test-secret"

    app = create_app()
    app.config.update(
        TESTING=True,
        WTF_CSRF_ENABLED=False,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    with app.app_context():
        db.drop_all()
        db.create_all()

    with app.test_client() as client:
        register = client.post(
            "/register",
            json={
                "username": "alice",
                "email": "alice@example.com",
                "password": "secret123",
                "confirm_password": "secret123",
            },
        )
        assert register.status_code == 201, register.get_json()
        assert register.get_json()["success"] is True

        login = client.post(
            "/login",
            json={
                "username": "alice",
                "password": "secret123",
            },
        )
        assert login.status_code == 200, login.get_json()
        assert login.get_json()["success"] is True
