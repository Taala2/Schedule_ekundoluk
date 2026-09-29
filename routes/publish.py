import os
from flask import Blueprint, jsonify, request
import kundoluk_client as kc
from services.group_service import normalize_groups
from services.publish_service import publish_one, publish_all
from storage.group_settings import load_group_settings
from .helpers import error_response

bp = Blueprint("publish", __name__)
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GROUP_SETTINGS_FILE = os.path.join(APP_DIR, "group_settings.json")


@bp.route("/api/publish-weeks")
def publish_weeks():
    grade_id = request.args.get("gradeId", "")
    try:
        data = kc.get_publish_data(grade_id)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify({"ok": True, "weeks": data["weeks"]})


@bp.route("/api/published-week")
def published_week():
    grade_id = request.args.get("gradeId", "")
    selected_day = request.args.get("selectedDay", "")
    if not grade_id or not selected_day:
        return error_response("gradeId и selectedDay обязательны", 400)
    try:
        data = kc.get_published_schedule(grade_id, selected_day)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify({"ok": True, "schedule": data})


@bp.route("/api/publish", methods=["POST"])
def publish():
    body = request.get_json(force=True)
    try:
        r = publish_one(kc, body.get("gradeId"), body.get("schoolId"), body.get("jugurtmoId"), body.get("targetDate"))
    except kc.ApiError as e:
        return error_response(e, 502)
    if not r["ok"]:
        return error_response(r["error"])
    return jsonify({"ok": True, "status": "published", "week": r["week"]})


@bp.route("/api/publish-all", methods=["POST"])
def publish_all_route():
    try:
        groups_data = kc.get_groups()
    except kc.ApiError as e:
        return error_response(e, 502)
    rows = normalize_groups(groups_data)
    settings = load_group_settings(GROUP_SETTINGS_FILE)
    body = request.get_json(silent=True) or {}
    target_date = body.get("targetDate")
    if not target_date:
        return error_response("targetDate обязателен для массовой публикации")
    try:
        results = publish_all(kc, rows, settings, target_date=target_date)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify({"ok": True, "results": results})
