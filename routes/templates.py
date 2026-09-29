import os
import uuid
from flask import Blueprint, jsonify, request
from storage.templates import load_templates, save_templates
from .helpers import error_response

bp = Blueprint("templates", __name__)
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES_FILE = os.path.join(APP_DIR, "templates.json")


@bp.route("/api/templates", methods=["GET"])
def templates_list():
    return jsonify({"ok": True, "rows": load_templates(TEMPLATES_FILE)})


@bp.route("/api/templates", methods=["POST"])
def templates_add():
    body = request.get_json(force=True)
    items = load_templates(TEMPLATES_FILE)
    item = {
        "id": str(uuid.uuid4()),
        "kind": body.get("kind", "combo"),
        "scope": body.get("scope", "global"),
        "label": body.get("label", ""),
        "subj": body.get("subj", ""),
        "subjectId": body.get("subjectId", ""),
        "staff": body.get("staff", ""),
        "staffId": body.get("staffId", ""),
        "staffSubjectId": body.get("staffSubjectId", ""),
        "room": body.get("room", ""),
        "roomId": body.get("roomId", ""),
        "bell": body.get("bell", ""),
    }
    items.append(item)
    save_templates(TEMPLATES_FILE, items)
    return jsonify({"ok": True, "item": item})


@bp.route("/api/templates/<tid>", methods=["DELETE"])
def templates_delete(tid):
    items = [t for t in load_templates(TEMPLATES_FILE) if t["id"] != tid]
    save_templates(TEMPLATES_FILE, items)
    return jsonify({"ok": True})
