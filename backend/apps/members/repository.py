from datetime import datetime, time

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from apps.members.database import get_members_collection


def _date_to_datetime(value):
    if hasattr(value, "year") and not isinstance(value, datetime):
        return datetime.combine(value, time.min)

    return value


def generate_member_id():
    """
    Return the next sequential member ID.

    MongoDB's atomic $inc guarantees that concurrent callers receive
    different sequence numbers. Existing records are skipped so a
    manually created ID can never be reused.
    """

    members = get_members_collection()
    counters = members.database["counters"]

    for _ in range(1000):
        try:
            counter = counters.find_one_and_update(
                {"_id": "member_id_sequence"},
                {"$inc": {"sequence": 1}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            # Another caller inserted the counter document first.
            continue

        candidate = f"A{counter['sequence']:03d}"

        if members.find_one(
            {"member_id": candidate},
            {"_id": 1},
        ) is None:
            return candidate

    raise RuntimeError("Unable to generate a unique member ID.")


def create_member(data):
    collection = get_members_collection()

    now = datetime.utcnow()

    document = {
        "member_id": data["member_id"],
        "name": data["name"],
        "phone": data["phone"],
        "email": data.get("email", ""),
        "date_of_birth": _date_to_datetime(
            data.get("date_of_birth")
        ),
        "gender": data.get("gender", ""),
        "joining_date": _date_to_datetime(
            data["joining_date"]
        ),
        "status": data.get("status", "active"),
        "password_reset_required": bool(
            data.get("password_reset_required", False)
        ),
        "emergency_contact": data.get(
            "emergency_contact",
            "",
        ),
        "preferred_session": data.get(
            "preferred_session"
        ),
        "created_at": now,
        "updated_at": now,
    }

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return document


def get_all_members():
    collection = get_members_collection()

    return list(
        collection.find().sort(
            [
                ("created_at", -1),
            ]
        )
    )


def get_member_by_id(member_id):
    collection = get_members_collection()

    return collection.find_one(
        {
            "member_id": member_id,
        }
    )


def update_member(member_id, data):
    collection = get_members_collection()

    update_data = {}

    for field, value in data.items():
        if field in {
            "date_of_birth",
            "joining_date",
        }:
            value = _date_to_datetime(value)

        update_data[field] = value

    if not update_data:
        return collection.find_one(
            {
                "member_id": member_id,
            }
        )

    update_data["updated_at"] = datetime.utcnow()

    result = collection.update_one(
        {
            "member_id": member_id,
        },
        {
            "$set": update_data,
        },
    )

    if result.matched_count == 0:
        return None

    return collection.find_one(
        {
            "member_id": member_id,
        }
    )