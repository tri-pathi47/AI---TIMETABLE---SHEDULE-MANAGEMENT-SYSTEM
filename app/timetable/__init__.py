from flask import Blueprint

timetable = Blueprint(
    "timetable",
    __name__,
    url_prefix="/timetable"
)

from app.timetable import routes