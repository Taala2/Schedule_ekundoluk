import os
import shutil
import tempfile
from copy import copy
from datetime import datetime, timedelta

from openpyxl import load_workbook
from openpyxl.cell.cell import MergedCell

REPORT_TYPES = [
    ("10m", "10 мес", "10 мес.xlsx"),
    ("1budget", "1 курс — бюджет", "1 курс бюджет.xlsx"),
    ("1contract", "1 курс — контракт", "1 курс контракт.xlsx"),
    ("2budget", "2 курс — бюджет", "2 курс бюджет.xlsx"),
    ("2contract", "2 курс — контракт", "2 курс контракт.xlsx"),
]
REPORT_KEYS = {key for key, _, _ in REPORT_TYPES}
DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]
SCHEDULE_KEYS = ["schedulesMon", "schedulesTue", "schedulesWed", "schedulesThu", "schedulesFri", "schedulesSat"]


def load_report_settings(path):
    import json
    if not os.path.exists(path):
        return {"academicYear": "", "includeSaturday": True, "groups": {key: [] for key in REPORT_KEYS}}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    groups = data.get("groups") if isinstance(data, dict) else {}
    if not isinstance(groups, dict):
        groups = {}
    return {
        "academicYear": str(data.get("academicYear", "")) if isinstance(data, dict) else "",
        "includeSaturday": bool(data.get("includeSaturday", True)) if isinstance(data, dict) else True,
        "groups": {key: list(groups.get(key) or []) if isinstance(groups.get(key) or [], list) else [] for key in REPORT_KEYS},
    }


def save_report_settings(path, data):
    import json
    clean = {
        "academicYear": str(data.get("academicYear", "")).strip(),
        "includeSaturday": bool(data.get("includeSaturday", True)),
        "groups": {key: list(data.get("groups", {}).get(key, [])) for key in REPORT_KEYS},
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(clean, f, ensure_ascii=False, indent=2)


def _copy_cell_style(src, dst):
    if isinstance(src, MergedCell) or isinstance(dst, MergedCell):
        return
    if src.has_style:
        dst._style = copy(src._style)
    if src.number_format:
        dst.number_format = src.number_format
    if src.alignment:
        dst.alignment = copy(src.alignment)
    if src.protection:
        dst.protection = copy(src.protection)


def _copy_row(ws, source_row, target_row, max_col=7):
    if target_row != source_row:
        ws.row_dimensions[target_row].height = ws.row_dimensions[source_row].height
    for col in range(1, max_col + 1):
        src = ws.cell(source_row, col)
        dst = ws.cell(target_row, col)
        _copy_cell_style(src, dst)
        if src.has_style:
            dst._style = copy(src._style)


def _remove_all_merges(ws):
    for rng in list(ws.merged_cells.ranges):
        ws.unmerge_cells(str(rng))


def _merge_like(ws, rng):
    try:
        ws.merge_cells(rng)
    except ValueError:
        pass


def _apply_template_structure(ws):
    # Rebuild the reusable document skeleton from the supplied template.
    _remove_all_merges(ws)
    ws.delete_rows(3, ws.max_row - 2)
    # Keep the original first two rows and recreate the group/table area.
    _merge_like(ws, "A1:F1")
    _merge_like(ws, "A2:C2")
    _merge_like(ws, "E2:F2")


def _set_group_header(ws, row, group_name):
    _copy_row(ws, 5, row)
    ws.cell(row, 1).value = group_name
    _merge_like(ws, f"A{row}:F{row}")


def _set_table_header(ws, row):
    _copy_row(ws, 6, row)
    headers = ["Дни", "Урок", "Звонок", "Название", "Преподаватель", "Кабинет"]
    for i, value in enumerate(headers, 1):
        ws.cell(row, i).value = value


def _set_lesson_row(ws, row, day, lesson):
    _copy_row(ws, 7, row)
    values = [
        day,
        lesson.get("lesson", lesson.get("lessonNumber", lesson.get("lessonNo", ""))),
        lesson.get("bell", ""),
        lesson.get("subjectName", ""),
        lesson.get("staffName", ""),
        lesson.get("roomName", ""),
    ]
    for i, value in enumerate(values, 1):
        ws.cell(row, i).value = value if value is not None else ""


def _published_days(schedule, include_saturday):
    days = []
    limit = 6 if include_saturday else 5
    if isinstance(schedule, dict):
        details = schedule.get("scheduleDetails")
        if isinstance(details, dict):
            schedule = details
        elif isinstance(schedule.get("data"), dict):
            nested = schedule["data"]
            if isinstance(nested.get("scheduleDetails"), dict):
                schedule = nested["scheduleDetails"]
            else:
                schedule = nested
    for idx in range(limit):
        raw = schedule.get(SCHEDULE_KEYS[idx], []) if isinstance(schedule, dict) else []
        if not isinstance(raw, list):
            raw = []
        lessons = [x for x in raw if isinstance(x, dict)]
        if lessons:
            lessons.sort(key=lambda x: _lesson_sort_key(x))
            days.append((DAYS[idx], lessons))
    return days


def _lesson_sort_key(item):
    value = item.get("lesson", item.get("lessonNumber", item.get("lessonNo", 0)))
    try:
        return (0, int(value))
    except (TypeError, ValueError):
        return (1, str(value))


def _capture_row(ws, row, max_col=7):
    values = []
    styles = []
    heights = ws.row_dimensions[row].height
    for col in range(1, max_col + 1):
        cell = ws.cell(row, col)
        values.append(cell.value)
        styles.append(copy(cell._style) if cell.has_style else None)
    return values, styles, heights


def _apply_row_prototype(ws, row, prototype):
    _, styles, height = prototype
    if height is not None:
        ws.row_dimensions[row].height = height
    for col, style in enumerate(styles, 1):
        if style is not None:
            ws.cell(row, col)._style = copy(style)


def build_report_file(template_path, output_path, title, period_text, groups, include_saturday):
    wb = load_workbook(template_path)
    ws = wb[wb.sheetnames[0]]

    group_label_proto = _capture_row(ws, 4)
    group_header_proto = _capture_row(ws, 5)
    table_header_proto = _capture_row(ws, 6)
    lesson_proto = _capture_row(ws, 7)
    signature_proto = _capture_row(ws, 50)

    for rng in list(ws.merged_cells.ranges):
        if rng.min_row >= 3:
            ws.unmerge_cells(str(rng))
    if ws.max_row > 2:
        ws.delete_rows(3, ws.max_row - 2)
    _merge_like(ws, "A1:F1")
    _merge_like(ws, "A2:C2")
    _merge_like(ws, "E2:F2")

    ws["A1"] = title
    ws["A2"] = period_text

    def set_group_header(row, group_name):
        # The sample has a separate blue merged "Группа" label above
        # the merged group-name row. Keep that structure for every group.
        _apply_row_prototype(ws, row, group_label_proto)
        ws.cell(row, 1).value = "Группа"
        _merge_like(ws, f"A{row}:F{row}")

        row += 1
        _apply_row_prototype(ws, row, group_header_proto)
        ws.cell(row, 1).value = group_name
        _merge_like(ws, f"A{row}:F{row}")
        return row

    def set_table_header(row):
        _apply_row_prototype(ws, row, table_header_proto)
        for i, value in enumerate(["Дни", "Урок", "Звонок", "Название", "Преподаватель", "Кабинет"], 1):
            ws.cell(row, i).value = value

    def set_lesson_row(row, day, lesson):
        _apply_row_prototype(ws, row, lesson_proto)
        values = [
            day,
            lesson.get("lesson", lesson.get("lessonNumber", lesson.get("lessonNo", ""))),
            lesson.get("bell", ""),
            lesson.get("subjectName", ""),
            lesson.get("staffName", ""),
            lesson.get("roomName", ""),
        ]
        for i, value in enumerate(values, 1):
            ws.cell(row, i).value = value if value is not None else ""

    row = 4
    written_groups = 0
    for group in groups:
        days = _published_days(group.get("schedule") or {}, include_saturday)
        if not days:
            continue
        if written_groups:
            row += 1
        row = set_group_header(row, group["gradeName"])
        row += 1
        set_table_header(row)
        row += 1
        for day_name, lessons in days:
            for lesson in lessons:
                set_lesson_row(row, day_name, lesson)
                row += 1
        written_groups += 1

    signature_row = row + 1
    _apply_row_prototype(ws, signature_row, signature_proto)
    ws.cell(signature_row, 1).value = "Зам. Директора по УПМР                                           Кененбаева Г. А."
    _merge_like(ws, f"A{signature_row}:F{signature_row}")
    wb.save(output_path)
    return written_groups

def monday_saturday_period(start_date, include_saturday):
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = start + timedelta(days=5 if include_saturday else 4)
    return start.strftime("%d.%m.%Y"), end.strftime("%d.%m.%Y")


def report_title(label, academic_year):
    if " — " in label:
        course, kind = label.split(" — ", 1)
        label = f"{course} ({kind})"
    return f"Расписание групп {label} {academic_year} учебный год"
