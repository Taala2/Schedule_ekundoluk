from datetime import date, datetime
import time


def pick_target_week(weeks, target_date_str=None):
    weeks_sorted = sorted(weeks, key=lambda w: w["startDate"])
    if target_date_str:
        for w in weeks_sorted:
            if w["startDate"] == target_date_str:
                return w
        return None
    today = date.today()
    for w in weeks_sorted:
        w_date = datetime.strptime(w["startDate"], "%Y-%m-%d").date()
        if w_date >= today and not w["isPublished"]:
            return w
    return None


def publish_one(kc, grade_id, school_id, jugurtmo_id, target_date=None):
    data = kc.get_publish_data(grade_id)
    week_row = pick_target_week(data["weeks"], target_date)
    if week_row is None:
        return {"ok": False, "error": "Подходящая неделя не найдена"}
    if not week_row["jugurtmoId"]:
        kc.insert_new_week(
            week_row["uniEduProgWeekId"], grade_id, school_id,
            jugurtmo_id, week_row["weekNo"], week_row["startDate"],
        )
        data = kc.get_publish_data(grade_id)
        week_row = next(w for w in data["weeks"] if w["weekNo"] == week_row["weekNo"])
    elif week_row["jugurtmoId"] != jugurtmo_id:
        # Неделя уже привязана к другой смене: перепривязываем к выбранной.
        kc.update_week(week_row["objectId"], jugurtmo_id)
        data = kc.get_publish_data(grade_id)
        week_row = next(w for w in data["weeks"] if w["objectId"] == week_row["objectId"])
    kc.publish_week(week_row["objectId"], grade_id)
    return {"ok": True, "week": week_row}


def publish_all(kc, groups_rows, settings, target_date=None, delay=0.3):
    by_grade = {}
    for row in groups_rows:
        by_grade.setdefault(row["gradeId"], []).append(row)

    results = []
    for grade_id, shift_rows in by_grade.items():
        grade_name = shift_rows[0]["gradeName"]
        default_id = (settings.get(grade_id) or {}).get("defaultJugurtmoId")
        target_row = None
        if default_id:
            target_row = next((r for r in shift_rows if r["objectId"] == default_id), None)
        if target_row is None:
            results.append({
                "label": grade_name,
                "status": "пропущено: не указана основная смена",
            })
            continue

        label = f"{grade_name} / {target_row['jugurtmoMainName']}"
        try:
            r = publish_one(kc, target_row["gradeId"], target_row["schoolId"], target_row["objectId"], target_date)
            results.append({"label": label, "status": "опубликовано" if r["ok"] else r["error"]})
        except kc.ApiError as e:
            results.append({"label": label, "status": f"ошибка: {e}"})
        time.sleep(delay)
    return results
