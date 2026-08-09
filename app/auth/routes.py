from flask import jsonify, request
from flask_login import login_user, logout_user, login_required

from app.auth import auth
from app.models import User
from app.extensions import db


def _clean_string(value):
    return str(value).strip() if value is not None else ""


@auth.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    username = _clean_string(data.get("username"))
    email = _clean_string(data.get("email"))
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

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

    if len(password) < 6:
        return jsonify({
            "success": False,
            "message": "Password must be at least 6 characters"
        }), 400

    if password != confirm_password:
        return jsonify({
            "success": False,
            "message": "Passwords do not match"
        }), 400

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({
            "success": False,
            "message": "Username already exists"
        }), 409

    existing_email = User.query.filter_by(email=email).first()
    if existing_email:
        return jsonify({
            "success": False,
            "message": "Email already registered"
        }), 409

    user = User(username=username, email=email)
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Registration successful"
    }), 201


@auth.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "GET":
        return jsonify({
            "success": True,
            "message": "Login endpoint is working. Use POST to login."
        })

    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "success": False,
            "message": "Invalid login data"
        }), 400

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({
            "success": False,
            "message": "Username and password are required"
        }), 400

    user = User.query.filter_by(
        username=username
    ).first()

    if not user or not user.check_password(password):
        return jsonify({
            "success": False,
            "message": "Invalid username or password"
        }), 401

    login_user(user)

    return jsonify({
        "success": True,
        "message": "Login successful",
        "username": user.username
    }), 200


@auth.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()

    return jsonify({
        "success": True,
        "message": "Logout successful"
    }), 200