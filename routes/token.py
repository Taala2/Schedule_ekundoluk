from flask import Blueprint, jsonify, request
import kundoluk_client as kc
from .helpers import error_response

bp = Blueprint("token", __name__)


@bp.route("/api/token", methods=["GET"])
def token_status():
    token = kc.load_token()
    return jsonify({"hasToken": bool(token), "preview": (token[:8] + "...") if token else ""})


@bp.route("/api/token", methods=["POST"])
def token_set():
    body = request.get_json(force=True)
    token = (body or {}).get("token", "").strip()
    if not token:
        return error_response("Пустой токен")
    kc.save_token(token)
    return jsonify({"ok": True})
