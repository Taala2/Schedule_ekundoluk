DAY_KEYS = [
    "jugurtmosMon", "jugurtmosTue", "jugurtmosWed",
    "jugurtmosThu", "jugurtmosFri", "jugurtmosSat",
]


def transform_week(raw):
    days = {}
    if isinstance(raw, dict):
        for i, key in enumerate(DAY_KEYS, start=1):
            items = raw.get(key) or []
            days[str(i)] = {}
            for it in items:
                lesson_no = str(it.get("lesson"))
                days[str(i)][lesson_no] = {
                    "objectId": it.get("objectId"),
                    "bell": it.get("bell"),
                    "subjectId": it.get("subjectId") or it.get("subjectID") or it.get("SubjectId"),
                    "subj": (
                        it.get("subjectName")
                        or it.get("subjectNameRu")
                        or it.get("translatedSubjectName")
                        or (it.get("subject") if isinstance(it.get("subject"), str) else "")
                        or ((it.get("subject") or {}).get("name", "") if isinstance(it.get("subject"), dict) else "")
                    ),
                    "staffId": it.get("staffId"),
                    "realStaffId": it.get("realStaffId") or it.get("staffId"),
                    "staffSubjectId": it.get("staffSubjectId"),
                    "staff": it.get("staffName") or it.get("staff") or "",
                    "roomId": it.get("roomId"),
                    "room": it.get("roomName") or it.get("room") or "",
                    "isContentSubject": it.get("isContentSubject", False),
                }
    return days
