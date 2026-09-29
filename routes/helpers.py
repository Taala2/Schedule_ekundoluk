from flask import jsonify


def error_response(e, code=400):
    return jsonify({"ok": False, "error": str(e)}), code
