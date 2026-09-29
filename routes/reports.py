import os
import re
import tempfile
from flask import Blueprint, jsonify, request, send_file

import kundoluk_client as kc
from services.report_service import (
    REPORT_TYPES,
    REPORT_KEYS,
    build_report_file,
    load_report_settings,
    monday_saturday_period,
    report_title,
    save_report_settings,
)
from .helpers import error_response

bp = Blueprint("reports", __name__)
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETTINGS_FILE = os.path.join(APP_DIR, "reports_settings.json")
TEMPLATE_FILE = os.path.join(APP_DIR, "report_template.xlsx")
OUTPUT_DIR = os.path.join(APP_DIR, "reports_output")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def _clean_name(name):
    return re.sub(r'[\\/:*?"<>|]+', "_", name)


@bp.route("/api/reports/weeks")
def reports_weeks():
    grade_id = request.args.get("gradeId", "").strip()
    if not grade_id:
        return error_response("gradeId обязателен", 400)
    try:
        data = kc.get_publish_data(grade_id)
    except kc.ApiError as e:
        return error_response(e, 502)
    weeks = data.get("weeks", []) if isinstance(data, dict) else []
    return jsonify({"ok": True, "weeks": weeks})


@bp.route("/api/reports/config")
def reports_config():
    return jsonify({"ok": True, "settings": load_report_settings(SETTINGS_FILE), "types": [{"key": k, "label": label, "filename": fn} for k, label, fn in REPORT_TYPES]})


@bp.route("/api/reports/config", methods=["POST"])
def reports_config_save():
    body = request.get_json(silent=True) or {}
    groups = body.get("groups") or {}
    normalized_groups = {}
    used = set()
    # A group has one explicit report destination. Enforce that rule on the
    # server as well, so stale/local UI state cannot reintroduce duplicates.
    for key, _, _ in REPORT_TYPES:
        clean = []
        for value in groups.get(key, []) or []:
            value = str(value)
            if value and value not in used:
                clean.append(value)
                used.add(value)
        normalized_groups[key] = clean
    settings = {
        "academicYear": str(body.get("academicYear", "")).strip(),
        "includeSaturday": bool(body.get("includeSaturday", True)),
        "groups": normalized_groups,
    }
    save_report_settings(SETTINGS_FILE, settings)
    return jsonify({"ok": True, "settings": settings})


@bp.route("/api/reports/generate", methods=["POST"])
def reports_generate():
    body = request.get_json(silent=True) or {}
    academic_year = str(body.get("academicYear", "")).strip()
    start_date = str(body.get("weekStartDate", "")).strip()
    include_saturday = bool(body.get("includeSaturday", True))
    selected_keys = body.get("reportKeys") or [key for key, _, _ in REPORT_TYPES]
    groups_config = body.get("groups") or {}

    if not re.fullmatch(r"\d{4}-\d{4}", academic_year):
        return error_response("Учебный год должен быть в формате 2025-2026", 400)
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", start_date):
        return error_response("Не выбрана неделя в режиме «Просмотр»", 400)
    selected_keys = [key for key in selected_keys if key in REPORT_KEYS]
    if not selected_keys:
        return error_response("Не выбран ни один отчёт", 400)
    if not os.path.exists(TEMPLATE_FILE):
        return error_response("Не найден шаблон Excel отчёта", 500)

    try:
        groups_data = kc.get_groups()
    except kc.ApiError as e:
        return error_response(e, 502)
    rows = groups_data.get("data", groups_data if isinstance(groups_data, list) else [])
    by_grade = {}
    for row in rows:
        grade_id = str(row.get("gradeId") or "")
        if grade_id and grade_id not in by_grade:
            by_grade[grade_id] = row

    try:
        start_text, end_text = monday_saturday_period(start_date, include_saturday)
    except ValueError:
        return error_response("Некорректная дата выбранной недели", 400)
    period_text = f"с {start_text} по {end_text}"

    generated = []
    skipped = []
    empty_configured = []
    for key, label, filename in REPORT_TYPES:
        if key not in selected_keys:
            continue
        configured_ids = [str(x) for x in (groups_config.get(key) or [])]
        groups = []
        for grade_id in configured_ids:
            base = by_grade.get(grade_id)
            if not base:
                continue
            try:
                schedule = kc.get_published_schedule(grade_id, start_date)
                # Some responses may wrap the single grade in a list. The
                # report builder expects the grade object itself.
                if isinstance(schedule, list):
                    schedule = next((item for item in schedule if str(item.get("gradeId", "")) == grade_id), schedule[0] if schedule else {})
                if isinstance(schedule, dict) and isinstance(schedule.get("data"), list):
                    schedule = next((item for item in schedule["data"] if str(item.get("gradeId", "")) == grade_id), {})
            except kc.ApiError as e:
                # A single broken group must not block the other reports.
                skipped.append(f"{base.get('gradeName', grade_id)}: {e}")
                continue
            groups.append({"gradeId": grade_id, "gradeName": base.get("gradeName", grade_id), "schedule": schedule or {}})

        if not groups:
            empty_configured.append(label)
            continue
        output_path = os.path.join(OUTPUT_DIR, _clean_name(filename))
        written = build_report_file(
            TEMPLATE_FILE,
            output_path,
            report_title(label, academic_year),
            period_text,
            groups,
            include_saturday,
        )
        if written == 0:
            continue
        generated.append({"key": key, "label": label, "filename": filename, "url": f"/api/reports/download/{_clean_name(filename)}", "groups": written})

    return jsonify({"ok": True, "files": generated, "skipped": skipped, "emptyConfigured": empty_configured, "period": period_text})


@bp.route("/api/reports/download/<path:filename>")
def reports_download(filename):
    safe = _clean_name(os.path.basename(filename))
    path = os.path.join(OUTPUT_DIR, safe)
    if not os.path.exists(path):
        return error_response("Файл отчёта не найден", 404)
    return send_file(path, as_attachment=True, download_name=safe)
