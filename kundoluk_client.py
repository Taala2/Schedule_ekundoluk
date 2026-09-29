import requests

BASE_URL = "https://kundoluk.edu.gov.kg/api"
TOKEN_FILE = "token.txt"


class ApiError(Exception):
    pass


def load_token():
    try:
        with open(TOKEN_FILE, encoding="utf-8") as f:
            token = f.read().strip()
    except FileNotFoundError:
        return ""
    return token


def save_token(token):
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        f.write(token.strip())


def _headers():
    token = load_token()
    return {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "CurrentLanguage": "ru",
        "Origin": "https://kundoluk.edu.gov.kg",
        "Referer": "https://kundoluk.edu.gov.kg/mon",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
        ),
    }


def _call(method, path, params=None, json_body=None):
    if not load_token():
        raise ApiError("Токен не задан. Вставь токен на странице приложения.")
    url = f"{BASE_URL}{path}"
    try:
        resp = requests.request(
            method, url, params=params, json=json_body,
            headers=_headers(), timeout=30,
        )
    except requests.RequestException as e:
        raise ApiError(f"Не удалось связаться с сайтом: {e}")

    if resp.status_code == 401:
        raise ApiError("Сайт отклонил токен (401) — скорее всего, он истёк. Обнови токен.")
    if not resp.ok:
        raise ApiError(f"Сайт вернул ошибку {resp.status_code}: {resp.text[:300]}")

    try:
        data = resp.json()
    except ValueError:
        raise ApiError("Сайт вернул не-JSON ответ (возможно, редирект на страницу логина).")

    if data.get("resultCode") not in (0, None):
        raise ApiError(data.get("resultMessage") or "Сайт вернул ошибку без описания")

    return data


def get(path, params=None):
    return _call("GET", path, params=params)


def post(path, params=None, json_body=None):
    return _call("POST", path, params=params, json_body=json_body)


def get_groups():
    """Список всех групп и их шаблонов расписания."""
    return post("/unischedule/getjugurtmomaindatagridlistpaged", json_body={}).get("actionResult")


def get_week_raw(jugurtmo_main_id):
    """RAW ответ сайта — используем пока не подтверждена точная структура."""
    return get(
        "/unischedule/getjugurtmoitemsbyjugurtmomainid",
        params={"jugurtmoMainId": jugurtmo_main_id},
    ).get("actionResult")


def get_subjects(grade_id):
    return post(
        "/subject/getsubjectlistselectboxbygrade",
        json_body={"ObjectIDString": grade_id},
    ).get("actionResult")


def get_staff(subject_id, grade_id, jugurtmo_item_id=""):
    params = {"subjectId": subject_id, "gradeId": grade_id}
    if jugurtmo_item_id:
        params["jugurtmoItemId"] = jugurtmo_item_id
    return get("/unischedule/getsubgroupsandstaff", params=params).get("actionResult")


def get_rooms():
    return post(
        "/room/getroomlistselectpaged",
        json_body={"searchOperation": "contains", "searchValue": None, "userData": {}},
    ).get("actionResult")


def save_lesson(payload):
    """payload — словарь в точности как ожидает savejugurtmoitem (см. README)."""
    return post("/jugurtmo/savejugurtmoitem", json_body=payload)


def delete_lesson(object_id):
    return post("/jugurtmo/deleteJugurtmoItem", json_body={"objectId": object_id})


def fill_day(jugurtmo_main_id, day):
    return post(
        "/unischedule/filljugurtmoday",
        params={"jugurtmoMainId": jugurtmo_main_id, "day": day},
    )


def get_publish_data(grade_id):
    return get("/unischedule/gradeschedulepublishdata", params={"gradeId": grade_id}).get("actionResult")

def get_published_schedule(grade_id, selected_day):
    """Возвращает опубликованную версию расписания для группы и недели.

    Запрос соответствует предоставленному cURL к
    /unischedule/queryunischedulespecificgrades.
    """
    return post(
        "/unischedule/queryunischedulespecificgrades",
        json_body={"GradeId": grade_id, "SelectedDay": selected_day},
    ).get("actionResult")


def insert_new_week(uni_edu_prog_week_id, grade_id, school_id, jugurtmo_id, week_no, start_date):
    return post(
        "/unischedule/insertnewunischeduleweek",
        json_body={
            "UniEduProgWeekId": uni_edu_prog_week_id,
            "GradeId": grade_id,
            "SchoolId": school_id,
            "JugurtmoId": jugurtmo_id,
            "WeekNo": week_no,
            "StartDate": start_date,
        },
    )


def update_week(week_id, jugurtmo_main_id):
    """Перепривязывает существующую неделю к выбранной смене."""
    return post(
        "/unischedule/updateunischeduleweek",
        params={"objectId": week_id, "jugurtmoMainId": jugurtmo_main_id},
        json_body={},
    )

def publish_week(week_id, grade_id):
    return post(
        "/unischedule/publishunischeduleweek",
        params={"weekId": week_id, "gradeId": grade_id},
        json_body={},
    )