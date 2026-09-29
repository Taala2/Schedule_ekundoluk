from flask import Blueprint, jsonify, request
import kundoluk_client as kc
from .helpers import error_response

bp = Blueprint("reference", __name__)


@bp.route("/api/subjects")
def subjects():
    grade_id = request.args.get("gradeId", "")
    try:
        data = kc.get_subjects(grade_id)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify({"ok": True, "rows": data})


@bp.route("/api/staff")
def staff():
    subject_id = request.args.get("subjectId", "")
    grade_id = request.args.get("gradeId", "")
    jugurtmo_item_id = request.args.get("jugurtmoItemId", "")
    try:
        data = kc.get_staff(subject_id, grade_id, jugurtmo_item_id)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify({"ok": True, "rows": data})


@bp.route("/api/rooms")
def rooms():
    try:
        data = kc.get_rooms()
    except kc.ApiError as e:
        return error_response(e, 502)
    rows = data.get("data", data if isinstance(data, list) else [])
    return jsonify({"ok": True, "rows": rows})
