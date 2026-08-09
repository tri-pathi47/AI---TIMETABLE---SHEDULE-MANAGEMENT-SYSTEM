from app import create_app
from app.extensions import db


def setup_test_app():
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
    return app


def test_auth_and_core_workflows():
    app = setup_test_app()
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
        assert register.status_code == 201
        assert register.get_json()["success"] is True

        duplicate_user = client.post(
            "/register",
            json={
                "username": "alice",
                "email": "alice2@example.com",
                "password": "secret123",
                "confirm_password": "secret123",
            },
        )
        assert duplicate_user.status_code == 409

        invalid_login = client.post(
            "/login",
            json={"username": "alice", "password": "wrongpass"},
        )
        assert invalid_login.status_code == 401

        login = client.post(
            "/login",
            json={"username": "alice", "password": "secret123"},
        )
        assert login.status_code == 200
        assert login.get_json()["success"] is True

        subject = client.post(
            "/subjects/add",
            json={
                "name": "Math",
                "difficulty": "Hard",
                "priority": "High",
                "exam_date": "2026-08-20",
                "estimated_hours": 5,
            },
        )
        assert subject.status_code == 201

        availability = client.post(
            "/availability/add",
            json={
                "date": "2026-08-09",
                "available_hours": 4,
                "start_time": "09:00",
                "end_time": "13:00",
                "energy_level": "High",
            },
        )
        assert availability.status_code == 201

        timetable = client.post("/timetable/generate")
        assert timetable.status_code == 201
        assert timetable.get_json()["success"] is True

        summary = client.get("/dashboard/summary")
        assert summary.status_code == 200
        assert summary.get_json()["success"] is True

        invalid_register = client.post(
            "/register",
            json={
                "username": "ab",
                "email": "bad-email",
                "password": "123",
                "confirm_password": "456",
            },
        )
        assert invalid_register.status_code == 400


def test_unauthorized_api_requests_return_json_401():
    app = setup_test_app()
    with app.test_client() as client:
        response = client.get("/subjects/")
        assert response.status_code == 401
        assert response.is_json
        assert response.get_json()["success"] is False


def test_authenticated_routes_work_end_to_end():
    app = setup_test_app()
    with app.test_client() as client:
        register = client.post(
            "/register",
            json={
                "username": "bob",
                "email": "bob@example.com",
                "password": "secret123",
                "confirm_password": "secret123",
            },
        )
        assert register.status_code == 201

        login = client.post(
            "/login",
            json={"username": "bob", "password": "secret123"},
        )
        assert login.status_code == 200

        subject = client.post(
            "/subjects/add",
            json={
                "name": "Biology",
                "difficulty": "Moderate",
                "priority": "Medium",
                "exam_date": "2026-08-22",
                "estimated_hours": 6,
            },
        )
        assert subject.status_code == 201

        subject_list = client.get("/subjects/")
        assert subject_list.status_code == 200

        subject_progress = client.get("/subjects/progress")
        assert subject_progress.status_code == 200

        availability = client.post(
            "/availability/add",
            json={
                "date": "2026-08-09",
                "available_hours": 5,
                "start_time": "08:00",
                "end_time": "13:00",
                "energy_level": "Medium",
            },
        )
        assert availability.status_code == 201

        availability_list = client.get("/availability/")
        assert availability_list.status_code == 200

        timetable = client.post("/timetable/generate")
        assert timetable.status_code == 201

        today_timetable = client.get("/timetable/today")
        assert today_timetable.status_code == 200

        timetable_progress = client.get("/timetable/progress")
        assert timetable_progress.status_code == 200

        weekly_progress = client.get("/timetable/weekly-progress")
        assert weekly_progress.status_code == 200

        complete = client.post("/timetable/1/complete")
        assert complete.status_code == 200

        dashboard = client.get("/dashboard/summary")
        assert dashboard.status_code == 200

        delete_subject = client.delete("/subjects/1")
        assert delete_subject.status_code == 200

        delete_availability = client.delete("/availability/1")
        assert delete_availability.status_code == 200


def test_dashboard_summary_includes_profile_info():
    app = setup_test_app()
    with app.test_client() as client:
        client.post(
            "/register",
            json={
                "username": "charlie",
                "email": "charlie@example.com",
                "password": "secret123",
                "confirm_password": "secret123",
            },
        )
        client.post(
            "/login",
            json={"username": "charlie", "password": "secret123"},
        )

        response = client.get("/dashboard/summary")
        assert response.status_code == 200
        payload = response.get_json()
        assert payload["user"]["username"] == "charlie"
        assert payload["user"]["email"] == "charlie@example.com"
        assert payload["user"]["total_subjects"] >= 0


def test_dashboard_profile_update_works():
    app = setup_test_app()
    with app.test_client() as client:
        client.post(
            "/register",
            json={
                "username": "diana",
                "email": "diana@example.com",
                "password": "secret123",
                "confirm_password": "secret123",
            },
        )
        client.post(
            "/login",
            json={"username": "diana", "password": "secret123"},
        )

        response = client.post(
            "/dashboard/profile",
            json={
                "username": "diana2",
                "email": "diana2@example.com",
                "current_password": "secret123",
                "new_password": "newsecret456",
            },
        )

        assert response.status_code == 200
        payload = response.get_json()
        assert payload["success"] is True
        assert payload["user"]["username"] == "diana2"
        assert payload["user"]["email"] == "diana2@example.com"

        login_again = client.post(
            "/login",
            json={"username": "diana2", "password": "newsecret456"},
        )
        assert login_again.status_code == 200


def test_dashboard_notifications_are_generated():
    app = setup_test_app()
    with app.test_client() as client:
        client.post(
            "/register",
            json={
                "username": "frank",
                "email": "frank@example.com",
                "password": "secret123",
                "confirm_password": "secret123",
            },
        )
        client.post(
            "/login",
            json={"username": "frank", "password": "secret123"},
        )

        client.post(
            "/subjects/add",
            json={
                "name": "Math",
                "difficulty": "Hard",
                "priority": "High",
                "exam_date": "2026-08-20",
                "estimated_hours": 5,
            },
        )

        client.post(
            "/availability/add",
            json={
                "date": "2026-08-09",
                "available_hours": 4,
                "start_time": "09:00",
                "end_time": "13:00",
                "energy_level": "High",
            },
        )

        client.post("/timetable/generate")

        response = client.get("/dashboard/notifications")
        assert response.status_code == 200
        payload = response.get_json()
        assert payload["success"] is True
        assert len(payload["notifications"]) >= 1
        assert any(item["type"] in {"study", "exam"} for item in payload["notifications"])


def test_dashboard_account_delete_works():
    app = setup_test_app()
    with app.test_client() as client:
        client.post(
            "/register",
            json={
                "username": "erin",
                "email": "erin@example.com",
                "password": "secret123",
                "confirm_password": "secret123",
            },
        )
        client.post(
            "/login",
            json={"username": "erin", "password": "secret123"},
        )

        response = client.delete(
            "/dashboard/account",
            json={"password": "secret123"},
        )

        assert response.status_code == 200
        payload = response.get_json()
        assert payload["success"] is True

        login_after_delete = client.post(
            "/login",
            json={"username": "erin", "password": "secret123"},
        )
        assert login_after_delete.status_code == 401


def test_home_template_uses_unique_dashboard_ids():
    app = setup_test_app()
    with app.test_client() as client:
        response = client.get("/")
        assert response.status_code == 200
        html = response.get_data(as_text=True)
        assert html.count('id="availableHoursValue"') == 1
        assert html.count('id="availableHoursInput"') == 1
        assert html.count('id="totalSubjects"') == 1
        assert html.count('id="totalSessions"') == 1
        assert html.count('id="progressValue"') == 1
        assert html.count('id="availableHours"') == 0
