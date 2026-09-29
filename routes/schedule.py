from flask import Blueprint, jsonify, request
import kundoluk_client as kc
from services.schedule_service import transform_week
from .helpers import error_response

bp = Blueprint("schedule", __name__)


@bp.route("/api/debug/week")
def debug_week():
    """Сырой (необработанный) ответ сайта — для сверки формата."""
    jugurtmo_main_id = request.args.get("jugurtmoMainId", "")
    try:
        raw = kc.get_week_raw(jugurtmo_main_id)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify(raw)


@bp.route("/api/week")
def week():
    jugurtmo_main_id = request.args.get("jugurtmoMainId", "")
    grade_id = request.args.get("gradeId", "")
    school_id = request.args.get("schoolId", "")
    try:
        raw = kc.get_week_raw(jugurtmo_main_id)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify({
        "ok": True,
        "gradeId": grade_id,
        "schoolId": school_id,
        "jugurtmoMainId": jugurtmo_main_id,
        "days": transform_week(raw),
    })


@bp.route("/api/day/fill", methods=["POST"])
def day_fill():
    body = request.get_json(force=True)
    jugurtmo_main_id = body.get("jugurtmoMainId")
    day = body.get("day")
    try:
        result = kc.fill_day(jugurtmo_main_id, day)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify({"ok": True, "result": result})
