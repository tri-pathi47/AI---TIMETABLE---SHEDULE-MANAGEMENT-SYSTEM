from flask import request, jsonify
from flask_login import login_required, current_user
from datetime import datetime

from app.subjects import subjects
from app.models import Subject, Timetable
from app.extensions import db


# ============================================================
# ADD SUBJECT
# ============================================================

@subjects.route("/add", methods=["POST"])
@login_required
def add_subject():

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "message": "No data provided"
        }), 400

    name = data.get("name")
    difficulty = data.get("difficulty")
    priority = data.get("priority", "Medium")
    exam_date = data.get("exam_date")
    estimated_hours = data.get("estimated_hours", 0)

    # --------------------------------------------------------
    # Validate subject name
    # --------------------------------------------------------

    if not name:
        return jsonify({
            "success": False,
            "message": "Subject name is required"
        }), 400

    # --------------------------------------------------------
    # Validate difficulty
    # --------------------------------------------------------

    if difficulty not in ["Easy", "Moderate", "Hard"]:
        return jsonify({
            "success": False,
            "message": "Difficulty must be Easy, Moderate or Hard"
        }), 400

    # --------------------------------------------------------
    # Validate priority
    # --------------------------------------------------------

    if priority not in ["Low", "Medium", "High"]:
        return jsonify({
            "success": False,
            "message": "Priority must be Low, Medium or High"
        }), 400

    # --------------------------------------------------------
    # Create subject
    # --------------------------------------------------------

    subject = Subject(
        name=name,
        difficulty=difficulty,
        priority=priority,
        estimated_hours=estimated_hours,
        user_id=current_user.id
    )

    # --------------------------------------------------------
    # Exam date
    # --------------------------------------------------------

    if exam_date:

        try:
            subject.exam_date = datetime.strptime(
                exam_date,
                "%Y-%m-%d"
            ).date()

        except ValueError:
            return jsonify({
                "success": False,
                "message": "Invalid exam date"
            }), 400

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    db.session.add(subject)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Subject added successfully",
        "subject_id": subject.id
    }), 201


# ============================================================
# GET ALL SUBJECTS
# ============================================================

@subjects.route("/", methods=["GET"])
@login_required
def get_subjects():

    subject_list = Subject.query.filter_by(
        user_id=current_user.id
    ).all()

    return jsonify({
        "success": True,
        "subjects": [
            {
                "id": subject.id,
                "name": subject.name,
                "difficulty": subject.difficulty,
                "priority": subject.priority,
                "exam_date": (
                    str(subject.exam_date)
                    if subject.exam_date
                    else None
                ),
                "estimated_hours": subject.estimated_hours
            }
            for subject in subject_list
        ]
    })


# ============================================================
# UPDATE SUBJECT
# ============================================================

@subjects.route("/<int:subject_id>", methods=["PUT"])
@login_required
def update_subject(subject_id):

    subject = Subject.query.filter_by(
        id=subject_id,
        user_id=current_user.id
    ).first()

    if not subject:
        return jsonify({
            "success": False,
            "message": "Subject not found"
        }), 404

    data = request.get_json(silent=True) or {}

    # --------------------------------------------------------
    # Validate provided fields
    # --------------------------------------------------------

    name = data.get("name", subject.name)

    if not name:
        return jsonify({
            "success": False,
            "message": "Subject name is required"
        }), 400

    difficulty = data.get("difficulty", subject.difficulty)

    if difficulty not in ["Easy", "Moderate", "Hard"]:
        return jsonify({
            "success": False,
            "message": "Difficulty must be Easy, Moderate or Hard"
        }), 400

    priority = data.get("priority", subject.priority)

    if priority not in ["Low", "Medium", "High"]:
        return jsonify({
            "success": False,
            "message": "Priority must be Low, Medium or High"
        }), 400

    estimated_hours = data.get(
        "estimated_hours",
        subject.estimated_hours
    )

    try:
        estimated_hours = float(estimated_hours or 0)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Estimated hours must be a number"
        }), 400

    # --------------------------------------------------------
    # Apply changes
    # --------------------------------------------------------

    subject.name = name
    subject.difficulty = difficulty
    subject.priority = priority
    subject.estimated_hours = max(estimated_hours, 0)

    exam_date = data.get("exam_date")

    if exam_date is not None:

        try:
            subject.exam_date = (
                datetime.strptime(
                    exam_date,
                    "%Y-%m-%d"
                ).date()
                if exam_date
                else None
            )

        except ValueError:
            return jsonify({
                "success": False,
                "message": "Invalid exam date"
            }), 400

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Subject updated successfully",
        "subject_id": subject.id
    })


# ============================================================
# DELETE SUBJECT
# ============================================================

@subjects.route("/<int:subject_id>", methods=["DELETE"])
@login_required
def delete_subject(subject_id):

    subject = Subject.query.filter_by(
        id=subject_id,
        user_id=current_user.id
    ).first()

    if not subject:
        return jsonify({
            "success": False,
            "message": "Subject not found"
        }), 404

    Timetable.query.filter_by(
        user_id=current_user.id,
        subject_id=subject_id
    ).delete()

    db.session.delete(subject)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Subject deleted successfully"
    })


# ============================================================
# SUBJECT PROGRESS
# ============================================================

@subjects.route("/progress", methods=["GET"])
@login_required
def subject_progress():

    subject_list = Subject.query.filter_by(
        user_id=current_user.id
    ).all()

    result = []

    for subject in subject_list:

        records = Timetable.query.filter_by(
            user_id=current_user.id,
            subject_id=subject.id,
            completed=True
        ).all()

        # ----------------------------------------------------
        # Calculate completed hours
        # ----------------------------------------------------

        completed_hours = sum(
            record.study_hours or 0
            for record in records
        )

        # ----------------------------------------------------
        # Estimated hours
        # ----------------------------------------------------

        estimated_hours = (
            subject.estimated_hours or 0
        )

        # ----------------------------------------------------
        # Remaining hours
        # ----------------------------------------------------

        remaining_hours = max(
            estimated_hours - completed_hours,
            0
        )

        # ----------------------------------------------------
        # Progress percentage
        # ----------------------------------------------------

        if estimated_hours > 0:

            progress_percentage = (
                completed_hours /
                estimated_hours
            ) * 100

        else:

            progress_percentage = 0

        progress_percentage = min(
            progress_percentage,
            100
        )

        # ----------------------------------------------------
        # Add result
        # ----------------------------------------------------

        result.append({
            "subject_id": subject.id,
            "subject": subject.name,
            "estimated_hours": estimated_hours,
            "completed_hours": completed_hours,
            "remaining_hours": remaining_hours,
            "progress_percentage": round(
                progress_percentage,
                2
            )
        })

    return jsonify({
        "success": True,
        "subjects": result
    })