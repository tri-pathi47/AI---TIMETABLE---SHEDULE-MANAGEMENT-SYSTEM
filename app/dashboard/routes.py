from flask import jsonify
from flask_login import login_required, current_user
from datetime import date, timedelta

from app.dashboard import dashboard
from app.models import (
    Subject,
    DailyAvailability,
    Timetable,
    User,
    NotificationSetting,
)
from app.extensions import db
from flask import request


def _get_or_create_settings():
    settings = NotificationSetting.query.filter_by(
        user_id=current_user.id
    ).first()

    if not settings:
        settings = NotificationSetting(user_id=current_user.id)
        db.session.add(settings)
        db.session.commit()

    return settings


def _serialize_settings(settings):
    return {
        "id": settings.id,
        "enabled": settings.enabled,
        "lead_minutes": settings.lead_minutes,
        "ai_enabled": settings.ai_enabled,
        "ai_frequency_minutes": settings.ai_frequency_minutes,
        "sound_name": settings.sound_name,
        "volume": settings.volume,
    }


@dashboard.route("/settings", methods=["GET"])
@login_required
def get_settings():
    settings = _get_or_create_settings()
    return jsonify({
        "success": True,
        "settings": _serialize_settings(settings)
    })


@dashboard.route("/settings", methods=["POST"])
@login_required
def update_settings():
    data = request.get_json(silent=True) or {}
    settings = _get_or_create_settings()

    if "enabled" in data:
        settings.enabled = bool(data["enabled"])

    if "lead_minutes" in data:
        try:
            lead = int(data["lead_minutes"])
        except (TypeError, ValueError):
            lead = 10
        settings.lead_minutes = max(0, min(lead, 120))

    if "ai_enabled" in data:
        settings.ai_enabled = bool(data["ai_enabled"])

    if "ai_frequency_minutes" in data:
        try:
            freq = int(data["ai_frequency_minutes"])
        except (TypeError, ValueError):
            freq = 45
        settings.ai_frequency_minutes = max(10, min(freq, 180))

    if "sound_name" in data:
        name = str(data["sound_name"]).strip()
        if name in {"chime", "beep", "soft", "none"}:
            settings.sound_name = name

    if "volume" in data:
        try:
            volume = int(data["volume"])
        except (TypeError, ValueError):
            volume = 70
        settings.volume = max(0, min(volume, 100))

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Notification settings updated",
        "settings": _serialize_settings(settings)
    })


# ============================================================
# AI GENERATED TIMETABLE ALERTS
# ============================================================

@dashboard.route("/exam-schedule", methods=["GET"])
@login_required
def exam_schedule():
    today = date.today()

    subjects = Subject.query.filter_by(
        user_id=current_user.id
    ).order_by(Subject.exam_date).all()

    schedule = []

    for subject in subjects:
        completed_hours = sum(
            record.study_hours or 0
            for record in Timetable.query.filter_by(
                user_id=current_user.id,
                subject_id=subject.id,
                completed=True
            ).all()
        )

        estimated_hours = subject.estimated_hours or 0
        remaining_hours = max(estimated_hours - completed_hours, 0)

        if subject.exam_date:
            days_left = (subject.exam_date - today).days
        else:
            days_left = None

        recommended_daily = 0
        if days_left is not None and days_left > 0 and remaining_hours > 0:
            recommended_daily = round(min(remaining_hours / days_left, 6), 1)

        schedule.append({
            "id": subject.id,
            "name": subject.name,
            "difficulty": subject.difficulty,
            "priority": subject.priority,
            "exam_date": str(subject.exam_date) if subject.exam_date else None,
            "days_left": days_left,
            "estimated_hours": estimated_hours,
            "completed_hours": completed_hours,
            "remaining_hours": remaining_hours,
            "recommended_daily": recommended_daily,
        })

    return jsonify({
        "success": True,
        "schedule": schedule
    })


@dashboard.route("/ai-alerts", methods=["GET"])
@login_required
def ai_alerts():
    today = date.today()
    settings = _get_or_create_settings()

    sessions = Timetable.query.filter_by(
        user_id=current_user.id,
        date=today,
        completed=False
    ).order_by(Timetable.start_time).all()

    alerts = []

    for session in sessions:
        if not session.start_time or not session.end_time:
            continue

        subject = Subject.query.filter_by(
            id=session.subject_id,
            user_id=current_user.id
        ).first()

        if not subject:
            continue

        alerts.append({
            "id": f"ai-session-{session.id}",
            "subject": subject.name,
            "start_time": session.start_time.strftime("%H:%M"),
            "end_time": session.end_time.strftime("%H:%M"),
            "lead_minutes": settings.lead_minutes,
        })

    return jsonify({
        "success": True,
        "alerts": alerts,
        "settings": _serialize_settings(settings),
    })


@dashboard.route("/summary", methods=["GET"])
@login_required
def dashboard_summary():

    today = date.today()

    # -----------------------------
    # Get today's availability
    # -----------------------------

    availability = DailyAvailability.query.filter_by(
        user_id=current_user.id,
        date=today
    ).first()

    available_hours = (
        availability.available_hours
        if availability
        else 0
    )

    # -----------------------------
    # Get user's subjects
    # -----------------------------

    total_subjects = Subject.query.filter_by(
        user_id=current_user.id
    ).count()

    # -----------------------------
    # Get today's timetable
    # -----------------------------

    records = Timetable.query.filter_by(
        user_id=current_user.id,
        date=today
    ).all()

    total_sessions = len(records)

    completed_sessions = sum(
        1
        for record in records
        if record.completed
    )

    total_hours = sum(
        record.study_hours or 0
        for record in records
    )

    completed_hours = sum(
        record.study_hours or 0
        for record in records
        if record.completed
    )

    # -----------------------------
    # Calculate progress
    # -----------------------------

    if total_hours > 0:
        progress_percentage = (
            completed_hours / total_hours
        ) * 100
    else:
        progress_percentage = 0

    # -----------------------------
    # Recommend how many hours to
    # study today to hit targets
    # -----------------------------

    subjects = Subject.query.filter_by(
        user_id=current_user.id
    ).all()

    remaining_hours_total = 0
    exam_windows = []

    for subject in subjects:

        completed = sum(
            record.study_hours or 0
            for record in Timetable.query.filter_by(
                user_id=current_user.id,
                subject_id=subject.id,
                completed=True
            ).all()
        )

        remaining_hours_total += max(
            (subject.estimated_hours or 0) - completed,
            0
        )

        if subject.exam_date and subject.exam_date >= today:
            exam_windows.append(
                (subject.exam_date - today).days
            )

    if remaining_hours_total > 0:
        window = min(
            [days for days in exam_windows if days >= 1],
            default=7
        )
        recommended_hours = round(
            min(remaining_hours_total / window, 6),
            1
        )
    else:
        recommended_hours = 0

    return jsonify({
        "success": True,
        "date": str(today),
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "total_subjects": total_subjects,
            "total_sessions": total_sessions,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "available_hours": available_hours,
        "total_subjects": total_subjects,
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "total_hours": total_hours,
        "completed_hours": completed_hours,
        "recommended_hours": recommended_hours,
        "progress_percentage": round(progress_percentage, 2)
    })


@dashboard.route("/profile", methods=["POST"])
@login_required
def update_profile():
    data = request.get_json(silent=True) or {}

    username = str(data.get("username", current_user.username)).strip()
    email = str(data.get("email", current_user.email)).strip()
    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if len(username) < 3 or len(username) > 50:
        return jsonify({
            "success": False,
            "message": "Username must be between 3 and 50 characters"
        }), 400

    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({
            "success": False,
            "message": "Valid email is required"
        }), 400

    existing_user = User.query.filter(User.username == username, User.id != current_user.id).first()
    if existing_user:
        return jsonify({
            "success": False,
            "message": "Username already exists"
        }), 409

    existing_email = User.query.filter(User.email == email, User.id != current_user.id).first()
    if existing_email:
        return jsonify({
            "success": False,
            "message": "Email already registered"
        }), 409

    if current_password is not None and current_password != "":
        if not current_user.check_password(current_password):
            return jsonify({
                "success": False,
                "message": "Current password is incorrect"
            }), 401

        if new_password is None or len(str(new_password)) < 6:
            return jsonify({
                "success": False,
                "message": "New password must be at least 6 characters"
            }), 400

        current_user.set_password(str(new_password))

    current_user.username = username
    current_user.email = email
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Profile updated successfully",
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "total_subjects": Subject.query.filter_by(user_id=current_user.id).count(),
            "total_sessions": Timetable.query.filter_by(user_id=current_user.id).count(),
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        }
    })


@dashboard.route("/account", methods=["DELETE"])
@login_required
def delete_account():
    data = request.get_json(silent=True) or {}
    password = data.get("password")

    if not password or not current_user.check_password(str(password)):
        return jsonify({
            "success": False,
            "message": "Password is incorrect"
        }), 401

    db.session.delete(current_user)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Account deleted successfully"
    })


@dashboard.route("/notifications", methods=["GET"])
@login_required
def notifications():
    today = date.today()
    notification_list = []

    pending_sessions = Timetable.query.filter_by(
        user_id=current_user.id,
        date=today,
        completed=False
    ).order_by(Timetable.start_time).all()

    if pending_sessions:
        first_session = pending_sessions[0]
        notification_list.append({
            "id": "study-reminder",
            "type": "study",
            "title": "Study reminder",
            "message": (
                f"You have {len(pending_sessions)} study session(s) left today. "
                f"Your next session is {first_session.subject.name} at "
                f"{first_session.start_time.strftime('%H:%M') if first_session.start_time else 'your planned time'}."
            ),
            "priority": "high" if first_session.priority_score and first_session.priority_score >= 7 else "medium",
            "time": first_session.start_time.strftime("%H:%M") if first_session.start_time else None,
        })
    else:
        notification_list.append({
            "id": "study-empty",
            "type": "study",
            "title": "Study plan",
            "message": "No study sessions remain today. Add or generate a new timetable to stay on track.",
            "priority": "low",
            "time": None,
        })

    upcoming_exams = Subject.query.filter_by(
        user_id=current_user.id
    ).filter(
        Subject.exam_date.isnot(None),
        Subject.exam_date >= today
    ).order_by(Subject.exam_date).limit(3).all()

    for subject in upcoming_exams:
        days_left = (subject.exam_date - today).days
        if days_left <= 7:
            notification_list.append({
                "id": f"exam-{subject.id}",
                "type": "exam",
                "title": "Exam alert",
                "message": f"{subject.name} is coming up in {days_left} day(s). Focus on revision and practice now.",
                "priority": "high" if days_left <= 3 else "medium",
                "time": str(subject.exam_date),
            })

    if not any(item["type"] == "exam" for item in notification_list):
        notification_list.append({
            "id": "exam-none",
            "type": "exam",
            "title": "Exam check",
            "message": "No exams are due in the next 7 days. Keep your study momentum strong.",
            "priority": "low",
            "time": None,
        })

    return jsonify({
        "success": True,
        "notifications": notification_list
    })


# ============================================================
# INSIGHTS & ACHIEVEMENTS
# ============================================================

@dashboard.route("/insights", methods=["GET"])
@login_required
def insights():

    today = date.today()

    records = Timetable.query.filter_by(
        user_id=current_user.id
    ).order_by(
        Timetable.date
    ).all()

    completed_records = [
        record
        for record in records
        if record.completed
    ]

    total_sessions = len(records)
    completed_sessions = len(completed_records)
    completed_hours = sum(
        record.study_hours or 0
        for record in completed_records
    )

    # --------------------------------------------------------
    # Streaks
    # --------------------------------------------------------

    completed_days = sorted(
        {record.date for record in completed_records}
    )

    longest_streak = 0
    current_streak = 0

    if completed_days:

        run = 1
        for i in range(1, len(completed_days)):
            if (completed_days[i] - completed_days[i - 1]).days == 1:
                run += 1
            else:
                longest_streak = max(longest_streak, run)
                run = 1

        longest_streak = max(longest_streak, run)

        day_set = set(completed_days)
        cursor = today

        if completed_days[-1] != today:
            cursor = today - timedelta(days=1)

        while cursor in day_set:
            current_streak += 1
            cursor -= timedelta(days=1)

    # --------------------------------------------------------
    # Badges
    # --------------------------------------------------------

    badges = []

    def add_badge(code, name, icon, description, earned):
        badges.append({
            "code": code,
            "name": name,
            "icon": icon,
            "description": description,
            "earned": earned,
        })

    add_badge(
        "first-step", "First Step", "🌱",
        "Complete your first study session",
        completed_sessions >= 1,
    )
    add_badge(
        "early-bird", "Early Bird", "☀️",
        "Complete 5 study sessions",
        completed_sessions >= 5,
    )
    add_badge(
        "consistent", "Consistent", "🎯",
        "Reach a 3-day study streak",
        longest_streak >= 3,
    )
    add_badge(
        "on-fire", "On Fire", "🔥",
        "Reach a 7-day study streak",
        longest_streak >= 7,
    )
    add_badge(
        "unstoppable", "Unstoppable", "⚡",
        "Reach a 14-day study streak",
        longest_streak >= 14,
    )
    add_badge(
        "hour-builder", "Hour Builder", "⏱️",
        "Complete 5 study hours",
        completed_hours >= 5,
    )
    add_badge(
        "marathon", "Marathon", "🏆",
        "Complete 25 study hours",
        completed_hours >= 25,
    )
    add_badge(
        "scholar", "Scholar", "🎓",
        "Complete 100 study hours",
        completed_hours >= 100,
    )

    return jsonify({
        "success": True,
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "completed_hours": completed_hours,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "badges": badges,
    })