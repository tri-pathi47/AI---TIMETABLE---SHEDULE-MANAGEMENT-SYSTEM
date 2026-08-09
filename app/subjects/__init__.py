from flask import Blueprint

subjects = Blueprint(
    "subjects",
    __name__,
    url_prefix="/subjects"
)

from app.subjects import routes