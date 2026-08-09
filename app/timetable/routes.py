
from datetime import date, timedelta

from flask import jsonify
from flask_login import login_required, current_user

from app.extensions import db
from app.models import Subject, DailyAvailability, Timetable
from app.scheduler.engine import generate_daily_schedule
from app.timetable import timetable


# ============================================================
# GET TODAY'S TIMETABLE
# ============================================================

@timetable.route("/today", methods=["GET"])
@login_required
def today_timetable():

    today = date.today()

    records = Timetable.query.filter_by(
        user_id=current_user.id,
        date=today
    ).order_by(
        Timetable.start_time
    ).all()

    return jsonify({
        "success": True,
        "date": str(today),
        "timetable": [
            {
                "id": record.id,
                "subject_id": record.subject_id,
                "subject": record.subject.name,
                "study_hours": record.study_hours,
                "priority_score": record.priority_score,
                "start_time": (
                    record.start_time.strftime("%H:%M")
                    if record.start_time
                    else None
                ),
                "end_time": (
                    record.end_time.strftime("%H:%M")
                    if record.end_time
                    else None
                ),
                "completed": record.completed
            }
            for record in records
        ]
    }), 200


# ============================================================
# GENERATE TODAY'S TIMETABLE
# ============================================================

@timetable.route("/generate", methods=["POST"])
@login_required
def generate_timetable():

    today = date.today()

    # --------------------------------------------------------
    # 1. Get today's availability
    # --------------------------------------------------------

    availability = DailyAvailability.query.filter_by(
        user_id=current_user.id,
        date=today
    ).first()

    if not availability:
        return jsonify({
            "success": False,
            "message": "Please set today's availability first."
        }), 400

    # --------------------------------------------------------
    # 2. Get user's subjects
    # --------------------------------------------------------

    subjects = Subject.query.filter_by(
        user_id=current_user.id
    ).all()

    if not subjects:
        return jsonify({
            "success": False,
            "message": "Please add at least one subject first."
        }), 400

    # --------------------------------------------------------
    # 3. Regenerate: replace any existing timetable for today
    # --------------------------------------------------------

    existing_records = Timetable.query.filter_by(
        user_id=current_user.id,
        date=today
    ).all()

    if existing_records:

        Timetable.query.filter_by(
            user_id=current_user.id,
            date=today
        ).delete()

        db.session.commit()

    # --------------------------------------------------------
    # 4. Generate schedule
    # --------------------------------------------------------

    schedule = generate_daily_schedule(
        subjects=subjects,
        available_hours=availability.available_hours,
        today=today,
        user_id=current_user.id
    )

    if not schedule:

        return jsonify({
            "success": False,
            "message": "Unable to generate a timetable."
        }), 400

    # --------------------------------------------------------
    # 5. Save schedule
    # --------------------------------------------------------

    saved_records = []

    try:

        for item in schedule:

            timetable_item = Timetable(
                date=today,
                subject_id=item["subject_id"],
                user_id=current_user.id,
                start_time=item["start_time"],
                end_time=item["end_time"],
                study_hours=item["hours"],
                priority_score=item["priority_score"],
                completed=False
            )

            db.session.add(timetable_item)
            saved_records.append(timetable_item)

        db.session.commit()

    except Exception:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Failed to save today's timetable."
        }), 500

    # --------------------------------------------------------
    # 6. Return timetable
    # --------------------------------------------------------

    return jsonify({
        "success": True,
        "message": "Today's timetable generated successfully.",
        "date": str(today),
        "timetable": [
            {
                "id": record.id,
                "subject_id": record.subject_id,
                "subject": record.subject.name,
                "hours": record.study_hours,
                "priority_score": record.priority_score,
                "start_time": (
                    record.start_time.strftime("%H:%M")
                    if record.start_time
                    else None
                ),
                "end_time": (
                    record.end_time.strftime("%H:%M")
                    if record.end_time
                    else None
                ),
                "completed": record.completed
            }
            for record in saved_records
        ]
    }), 201


# ============================================================
# GET TIMETABLE HISTORY
# ============================================================

@timetable.route("/history", methods=["GET"])
@login_required
def timetable_history():

    records = Timetable.query.filter_by(
        user_id=current_user.id
    ).order_by(
        Timetable.date.desc(),
        Timetable.start_time
    ).all()

    history = {}

    for record in records:

        day = str(record.date)

        history.setdefault(day, []).append({
            "id": record.id,
            "subject_id": record.subject_id,
            "subject": record.subject.name,
            "study_hours": record.study_hours,
            "start_time": (
                record.start_time.strftime("%H:%M")
                if record.start_time
                else None
            ),
            "end_time": (
                record.end_time.strftime("%H:%M")
                if record.end_time
                else None
            ),
            "completed": record.completed
        })

    return jsonify({
        "success": True,
        "history": history
    }), 200


# ============================================================
# MARK STUDY SESSION AS COMPLETED
# ============================================================

@timetable.route(
    "/<int:timetable_id>/complete",
    methods=["POST"]
)
@login_required
def complete_timetable(timetable_id):

    record = Timetable.query.filter_by(
        id=timetable_id,
        user_id=current_user.id
    ).first()

    if not record:

        return jsonify({
            "success": False,
            "message": "Timetable record not found."
        }), 404

    if record.completed:

        return jsonify({
            "success": False,
            "message": "This study session is already completed."
        }), 400

    record.completed = True

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Study session completed successfully.",
        "timetable_id": record.id,
        "subject_id": record.subject_id,
        "subject": record.subject.name,
        "completed": record.completed
    }), 200


# ============================================================
# GET TODAY'S PROGRESS
# ============================================================

@timetable.route("/progress", methods=["GET"])
@login_required
def timetable_progress():

    today = date.today()

    records = Timetable.query.filter_by(
        user_id=current_user.id,
        date=today
    ).all()

    total_sessions = len(records)

    completed_records = [
        record
        for record in records
        if record.completed
    ]

    completed_sessions = len(completed_records)

    total_hours = sum(
        record.study_hours or 0
        for record in records
    )

    completed_hours = sum(
        record.study_hours or 0
        for record in completed_records
    )

    if total_hours > 0:
        progress_percentage = (
            completed_hours / total_hours
        ) * 100
    else:
        progress_percentage = 0

    return jsonify({
        "success": True,
        "date": str(today),
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "total_hours": total_hours,
        "completed_hours": completed_hours,
        "progress_percentage": round(
            progress_percentage,
            2
        )
    }), 200


# ============================================================
# GET WEEKLY PROGRESS
# ============================================================

@timetable.route("/weekly-progress", methods=["GET"])
@login_required
def weekly_progress():

    today = date.today()

    week_start = today - timedelta(days=6)

    records = Timetable.query.filter(
        Timetable.user_id == current_user.id,
        Timetable.date >= week_start,
        Timetable.date <= today
    ).order_by(
        Timetable.date
    ).all()

    weekly_data = {}

    current_date = week_start

    while current_date <= today:

        weekly_data[str(current_date)] = {
            "total_hours": 0,
            "completed_hours": 0,
            "total_sessions": 0,
            "completed_sessions": 0
        }

        current_date += timedelta(days=1)

    for record in records:

        day = str(record.date)

        weekly_data[day]["total_hours"] += (
            record.study_hours or 0
        )

        weekly_data[day]["total_sessions"] += 1

        if record.completed:

            weekly_data[day]["completed_hours"] += (
                record.study_hours or 0
            )

            weekly_data[day]["completed_sessions"] += 1

    return jsonify({
        "success": True,
        "week_start": str(week_start),
        "week_end": str(today),
        "weekly_progress": weekly_data
    }), 200

