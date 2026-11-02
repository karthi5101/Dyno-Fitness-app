import re


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def slugify_exercise_id(value):
    value = str(value or "").lower().replace("_", "-")
    value = re.sub(r"[^a-z0-9-]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")

    return value


def is_valid_slug(value):
    return bool(value and SLUG_PATTERN.fullmatch(value))


def normalize_text(value):
    return " ".join(str(value or "").split()).strip()


def normalize_text_list(values, lowercase=False):
    if not isinstance(values, list):
        return []

    normalized = []

    for value in values:
        text = normalize_text(value)

        if not text:
            continue

        normalized.append(text.lower() if lowercase else text)

    return normalized


def tracking_type_for(category, equipment):
    category = normalize_text(category).lower()
    equipment = normalize_text(equipment).lower()

    if category in {"cardio", "stretching"}:
        return "time"

    if equipment == "body only":
        return "reps"

    return "weight_reps"
