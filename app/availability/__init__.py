from flask import Blueprint

availability = Blueprint(
    "availability",
    __name__,
    url_prefix="/availability"
)

from app.availability import routes