import os
from flask import Blueprint, jsonify, request
from storage.group_settings import load_group_settings, save_group_settings
from .helpers import error_response

bp = Blueprint("group_settings", __name__)
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GROUP_SETTINGS_FILE = os.path.join(APP_DIR, "group_settings.json")


@bp.route("/api/group-settings", methods=["GET"])
def group_settings_get():
    return jsonify({"ok": True, "settings": load_group_settings(GROUP_SETTINGS_FILE)})


@bp.route("/api/group-settings", methods=["POST"])
def group_settings_set():
    body = request.get_json(force=True)
    grade_id = body.get("gradeId")
    jugurtmo_id = body.get("jugurtmoId")
    if not grade_id:
        return error_response("gradeId обязателен")
    settings = load_group_settings(GROUP_SETTINGS_FILE)
    settings[grade_id] = {"defaultJugurtmoId": jugurtmo_id}
    save_group_settings(GROUP_SETTINGS_FILE, settings)
    return jsonify({"ok": True})
