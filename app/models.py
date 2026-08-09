from app.extensions import db, login_manager
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


class User(db.Model, UserMixin):

    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    username = db.Column(
        db.String(50),
        unique=True,
        nullable=False
    )

    email = db.Column(
        db.String(100),
        unique=True,
        nullable=False
    )

    password = db.Column(
        db.String(255),
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    subjects = db.relationship(
        "Subject",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan"
    )

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(
            self.password,
            password
        )
    availabilities = db.relationship(
        "DailyAvailability",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan"
    )

class Subject(db.Model):

    __tablename__ = "subjects"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(100),
        nullable=False
    )

    difficulty = db.Column(
        db.String(20),
        nullable=False
    )

    priority = db.Column(
        db.String(20),
        nullable=False,
        default="Medium"
    )

    exam_date = db.Column(
        db.Date,
        nullable=True
    )

    estimated_hours = db.Column(
        db.Float,
        nullable=False,
        default=0
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )
    
class DailyAvailability(db.Model):


    __tablename__ = "daily_availability"

    id = db.Column(db.Integer, primary_key=True)

    date = db.Column(db.Date, nullable=False)

    available_hours = db.Column(db.Float, nullable=False)

    start_time = db.Column(db.Time, nullable=True)

    end_time = db.Column(db.Time, nullable=True)

    energy_level = db.Column(
        db.String(20),
        nullable=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )


class Timetable(db.Model):
    __tablename__ = "timetables"

    id = db.Column(db.Integer, primary_key=True)

    date = db.Column(
        db.Date,
        nullable=False
    )
    subject = db.relationship(
    "Subject",
    backref="timetables"
)

    user = db.relationship(
    "User",
    backref="timetables"
)
    subject_id = db.Column(
        db.Integer,
        db.ForeignKey("subjects.id"),
        nullable=False
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    start_time = db.Column(
        db.Time,
        nullable=True
    )

    end_time = db.Column(
        db.Time,
        nullable=True
    )

    study_hours = db.Column(
        db.Float,
        nullable=False
    )

    priority_score = db.Column(
        db.Integer,
        nullable=True
    )

    completed = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )