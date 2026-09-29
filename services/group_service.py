def normalize_groups(data):
    rows = data.get("data", data if isinstance(data, list) else [])
    return rows
