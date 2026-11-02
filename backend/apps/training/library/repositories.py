import base64
import json
import re

from bson import ObjectId
from bson.errors import InvalidId
from django.utils import timezone

from apps.training.database import get_exercises_collection

from .utils import (
    normalize_text,
    normalize_text_list,
    slugify_exercise_id,
    tracking_type_for,
)


def parse_object_id(value):
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError, ValueError):
        return None


def encode_cursor(document):
    payload = {
        "name_lc": document["name_lc"],
        "id": str(document["_id"]),
    }
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode()

    return encoded.rstrip("=")


def decode_cursor(value):
    try:
        padded = value + ("=" * (-len(value) % 4))
        payload = json.loads(
            base64.urlsafe_b64decode(padded.encode()).decode()
        )
        name_lc = payload["name_lc"]
        object_id = ObjectId(payload["id"])

        if not isinstance(name_lc, str):
            raise ValueError

        return {
            "name_lc": name_lc,
            "_id": object_id,
        }
    except Exception as exc:
        raise ValueError("Invalid cursor.") from exc


def list_exercises(filters=None, limit=20, cursor=None):
    filters = filters or {}
    conditions = [{"archived": False}]

    query_text = normalize_text(filters.get("q"))

    if query_text:
        conditions.append(
            {
                "name_lc": {
                    "$regex": re.escape(query_text.lower()),
                }
            }
        )

    muscle = normalize_text(filters.get("muscle")).lower()

    if muscle:
        conditions.append(
            {
                "$or": [
                    {"primary_muscles": muscle},
                    {"secondary_muscles": muscle},
                ]
            }
        )

    for field in ("equipment", "level", "category"):
        value = normalize_text(filters.get(field)).lower()

        if value:
            conditions.append({field: value})

    favorite_by = normalize_text(filters.get("favorite_by"))

    if favorite_by:
        conditions.append({"favorite_by": favorite_by})

    if cursor:
        cursor_data = decode_cursor(cursor)
        conditions.append(
            {
                "$or": [
                    {"name_lc": {"$gt": cursor_data["name_lc"]}},
                    {
                        "name_lc": cursor_data["name_lc"],
                        "_id": {"$gt": cursor_data["_id"]},
                    },
                ]
            }
        )

    collection = get_exercises_collection()
    documents = list(
        collection.find({"$and": conditions})
        .sort([("name_lc", 1), ("_id", 1)])
        .limit(limit + 1)
    )

    next_cursor = None

    if len(documents) > limit:
        documents = documents[:limit]
        next_cursor = encode_cursor(documents[-1])

    return documents, next_cursor


def get_exercise_by_id(exercise_id):
    object_id = parse_object_id(exercise_id)

    if object_id is None:
        return None

    return get_exercises_collection().find_one(
        {
            "_id": object_id,
            "archived": False,
        }
    )


def create_custom_exercise(data, created_by):
    collection = get_exercises_collection()
    name = normalize_text(data.get("name"))
    slug = slugify_exercise_id(name)

    if not slug:
        raise ValueError("A valid exercise name is required.")

    if collection.find_one({"slug": slug}, {"_id": 1}):
        raise ValueError("An exercise with this name already exists.")

    now = timezone.now()
    document = {
        "slug": slug,
        "name": name,
        "name_lc": name.lower(),
        "primary_muscles": normalize_text_list(
            data.get("primary_muscles"),
            lowercase=True,
        ),
        "secondary_muscles": normalize_text_list(
            data.get("secondary_muscles"),
            lowercase=True,
        ),
        "equipment": normalize_text(
            data.get("equipment")
        ).lower(),
        "level": data.get("level") or "beginner",
        "category": data.get("category") or "strength",
        "instructions": normalize_text_list(
            data.get("instructions")
        ),
        "images": [],
        "video_file_id": None,
        "tracking_type": (
            data.get("tracking_type")
            or tracking_type_for(
                data.get("category"),
                data.get("equipment"),
            )
        ),
        "is_custom": True,
        "created_by": created_by,
        "archived": False,
        "favorite_by": [],
        "created_at": now,
        "updated_at": now,
    }

    result = collection.insert_one(document)

    return collection.find_one({"_id": result.inserted_id})


def update_custom_exercise(exercise_id, data):
    object_id = parse_object_id(exercise_id)

    if object_id is None:
        return None

    collection = get_exercises_collection()
    existing = collection.find_one(
        {
            "_id": object_id,
            "archived": False,
        }
    )

    if existing is None:
        return None

    if not existing.get("is_custom"):
        raise PermissionError(
            "System exercises are read-only."
        )

    updates = {}

    if "name" in data:
        name = normalize_text(data["name"])

        if not name:
            raise ValueError("A valid exercise name is required.")

        updates["name"] = name
        updates["name_lc"] = name.lower()

    if "primary_muscles" in data:
        updates["primary_muscles"] = normalize_text_list(
            data["primary_muscles"],
            lowercase=True,
        )

    if "secondary_muscles" in data:
        updates["secondary_muscles"] = normalize_text_list(
            data["secondary_muscles"],
            lowercase=True,
        )

    if "equipment" in data:
        updates["equipment"] = normalize_text(
            data["equipment"]
        ).lower()

    for field in ("level", "category", "tracking_type"):
        if field in data:
            updates[field] = data[field]

    if "instructions" in data:
        updates["instructions"] = normalize_text_list(
            data["instructions"]
        )

    if (
        "category" in data or "equipment" in data
    ) and "tracking_type" not in data:
        updates["tracking_type"] = tracking_type_for(
            data.get("category", existing.get("category")),
            data.get("equipment", existing.get("equipment")),
        )

    updates["updated_at"] = timezone.now()

    collection.update_one(
        {"_id": object_id},
        {"$set": updates},
    )

    return collection.find_one({"_id": object_id})
