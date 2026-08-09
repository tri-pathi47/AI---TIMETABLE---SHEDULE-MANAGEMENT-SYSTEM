from flask import request, jsonify
from flask_login import login_required, current_user
from datetime import datetime

from app.availability import availability
from app.models import DailyAvailability
from app.extensions import db


@availability.route("/add", methods=["POST"])
@login_required
def add_availability():

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "message": "No data provided"
        }), 400

    date_value = data.get("date")
    available_hours = data.get("available_hours")
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    energy_level = data.get("energy_level")

    if not date_value or available_hours is None:
        return jsonify({
            "success": False,
            "message": "Date and available hours are required"
        }), 400

    try:
        date_value = datetime.strptime(
            date_value,
            "%Y-%m-%d"
        ).date()

        available_hours = float(available_hours)

    except ValueError:
        return jsonify({
            "success": False,
            "message": "Invalid date or available hours"
        }), 400

    start = None
    end = None

    if start_time:
        try:
            start = datetime.strptime(
                start_time,
                "%H:%M"
            ).time()
        except ValueError:
            return jsonify({
                "success": False,
                "message": "Invalid start time"
            }), 400

    if end_time:
        try:
            end = datetime.strptime(
                end_time,
                "%H:%M"
            ).time()
        except ValueError:
            return jsonify({
                "success": False,
                "message": "Invalid end time"
            }), 400

    availability_data = DailyAvailability(
        date=date_value,
        available_hours=available_hours,
        start_time=start,
        end_time=end,
        energy_level=energy_level,
        user_id=current_user.id
    )

    db.session.add(availability_data)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Availability added successfully",
        "availability_id": availability_data.id
    }), 201


@availability.route("/", methods=["GET"])
@login_required
def get_availability():

    records = DailyAvailability.query.filter_by(
        user_id=current_user.id
    ).order_by(
        DailyAvailability.date
    ).all()

    return jsonify({
        "success": True,
        "availability": [
            {
                "id": record.id,
                "date": str(record.date),
                "available_hours": record.available_hours,
                "start_time": str(record.start_time)
                if record.start_time else None,
                "end_time": str(record.end_time)
                if record.end_time else None,
                "energy_level": record.energy_level
            }
            for record in records
        ]
    })


@availability.route("/<int:availability_id>", methods=["DELETE"])
@login_required
def delete_availability(availability_id):

    record = DailyAvailability.query.filter_by(
        id=availability_id,
        user_id=current_user.id
    ).first()

    if not record:
        return jsonify({
            "success": False,
            "message": "Availability not found"
        }), 404

    db.session.delete(record)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Availability deleted successfully"
    })