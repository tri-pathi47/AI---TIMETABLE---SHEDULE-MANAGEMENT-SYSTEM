from flask import Blueprint

auth = Blueprint("auth", __name__)

from app.auth import routes

from flask import Blueprint

subjects = Blueprint(
    "subjects",
    __name__,
    url_prefix="/subjects"
)

from app.subjects import routes