from flask import Blueprint, jsonify
import kundoluk_client as kc
from services.group_service import normalize_groups
from .helpers import error_response

bp = Blueprint("groups", __name__)


@bp.route("/api/groups")
def groups():
    try:
        data = kc.get_groups()
    except kc.ApiError as e:
        return error_response(e, 502)
    rows = normalize_groups(data)
    return jsonify({"ok": True, "rows": rows})
