from flask import Blueprint, jsonify, request
import kundoluk_client as kc
from .helpers import error_response

bp = Blueprint("lessons", __name__)


@bp.route("/api/lesson/save", methods=["POST"])
def lesson_save():
    body = request.get_json(force=True)
    bell = body.get("bell")
    if not isinstance(bell, str) or not bell.strip():
        return error_response("Время урока (bell) обязательно")

    payload = {
        "objectId": body.get("objectId"),
        "schoolId": body.get("schoolId"),
        "gradeId": body.get("gradeId"),
        "gradeItemId": body.get("gradeItemId"),
        "jugurtmoMainId": body.get("jugurtmoMainId"),
        "gradeItemName": body.get("gradeItemName"),
        "weekday": body.get("weekday"),
        "lesson": str(body.get("lesson")),
        "bell": bell.strip(),
        "staffSubjectId": body.get("staffSubjectId"),
        "staffId": body.get("staffId"),
        "realStaffId": body.get("realStaffId") or body.get("staffId"),
        "subjectId": body.get("subjectId"),
        "subjectGroupId": body.get("subjectGroupId"),
        "roomId": body.get("roomId"),
        "isContentSubject": body.get("isContentSubject", False),
        "summary": body.get("summary"),
        "staffSubjectIdString": body.get("staffSubjectIdString"),
    }
    try:
        result = kc.save_lesson(payload)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify({"ok": True, "result": result})


@bp.route("/api/lesson/delete", methods=["POST"])
def lesson_delete():
    body = request.get_json(force=True)
    object_id = body.get("objectId")
    if not object_id:
        return error_response("objectId обязателен")
    try:
        result = kc.delete_lesson(object_id)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify({"ok": True, "result": result})


@bp.route("/api/lesson/swap", methods=["POST"])
def lesson_swap():
    body = request.get_json(force=True)
    a, b = body.get("a"), body.get("b")
    if not a or not b:
        return error_response("Нужны обе ячейки (a и b)")
    if not a.get("objectId") or not b.get("objectId"):
        return error_response("У одной из ячеек нет objectId — сначала заполни часы для этого дня")

    def content_of(x):
        return {
            "subjectId": x.get("subjectId"),
            "staffId": x.get("staffId"),
            "realStaffId": x.get("realStaffId"),
            "staffSubjectId": x.get("staffSubjectId"),
            "roomId": x.get("roomId"),
        }

    content_a, content_b = content_of(a), content_of(b)
    try:
        for cell, new_content in ((a, content_b), (b, content_a)):
            payload = {
                "objectId": cell.get("objectId"),
                "schoolId": cell.get("schoolId"),
                "gradeId": cell.get("gradeId"),
                "gradeItemId": None,
                "jugurtmoMainId": cell.get("jugurtmoMainId"),
                "gradeItemName": None,
                "weekday": cell.get("weekday"),
                "lesson": str(cell.get("lesson")),
                "bell": cell.get("bell"),
                **new_content,
                "subjectGroupId": None,
                "isContentSubject": False,
                "summary": None,
                "staffSubjectIdString": None,
            }
            kc.save_lesson(payload)
    except kc.ApiError as e:
        return error_response(e, 502)
    return jsonify({"ok": True})
