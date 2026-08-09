import os

from flask import Flask, jsonify, request, render_template
from dotenv import load_dotenv

from app.config import Config
from app.extensions import db, migrate, login_manager

load_dotenv()


def create_app():

    app = Flask(__name__)
    app.config.from_object(Config)
    app.config["JSON_SORT_KEYS"] = False

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "success": False,
            "message": "Resource not found"
        }), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            "success": False,
            "message": "Method not allowed"
        }), 405

    @app.errorhandler(500)
    def server_error(error):
        if request.path.startswith("/"):
            return jsonify({
                "success": False,
                "message": "Internal server error"
            }), 500
        return error

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    # Import models
    from app import models

    # Register Auth blueprint
    from app.auth import auth
    app.register_blueprint(auth)

    # # Register Subjects blueprint
    from app.subjects import subjects
    app.register_blueprint(subjects)


    from app.availability import availability
    app.register_blueprint(availability)

    from app.timetable import timetable

    app.register_blueprint(timetable)

    from app.dashboard import dashboard

    app.register_blueprint(dashboard)

    @app.route("/")
    def home():
        return render_template("index.html")

    @app.route("/health")
    def health():
        return jsonify({
            "success": True,
            "status": "ok",
            "app": "AI Study Scheduler",
            "environment": os.environ.get("FLASK_ENV", "development")
        })

    return app