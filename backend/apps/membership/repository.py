from datetime import datetime, time

from apps.membership.database import (
    get_memberships_collection,
)


def _date_to_datetime(value):
    if hasattr(value, "year") and not isinstance(value, datetime):
        return datetime.combine(value, time.min)

    return value


def create_membership(data):
    collection = get_memberships_collection()

    now = datetime.utcnow()

    document = {
        "member_id": data["member_id"],
        "plan_name": data["plan_name"],
        "start_date": _date_to_datetime(
            data["start_date"]
        ),
        "end_date": _date_to_datetime(
            data["end_date"]
        ),
        "status": data.get("status", "active"),
        "created_at": now,
        "updated_at": now,
    }

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return document


def get_all_memberships():
    collection = get_memberships_collection()

    return list(
        collection.find().sort(
            [
                ("created_at", -1),
            ]
        )
    )


def get_membership_by_member_id(member_id):
    collection = get_memberships_collection()

    return collection.find_one(
        {
            "member_id": member_id,
        }
    )


def update_membership(member_id, data):
    collection = get_memberships_collection()

    update_data = {}

    for field, value in data.items():
        if field in {
            "start_date",
            "end_date",
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