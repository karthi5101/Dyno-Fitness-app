from datetime import date, datetime, timezone

from bson import ObjectId

from apps.transformations.database import (
    get_transformations_collection,
)


def utc_now():
    return datetime.now(timezone.utc)


def normalize_recorded_date(value):
    """
    Convert date/datetime values into MongoDB-compatible UTC datetime.
    """

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)

        return value.astimezone(timezone.utc)

    if isinstance(value, date):
        return datetime(
            value.year,
            value.month,
            value.day,
            tzinfo=timezone.utc,
        )

    raise ValueError(
        "recorded_date must be a date or datetime."
    )


def normalize_weight(value):
    """
    Convert DRF Decimal values into a MongoDB-compatible numeric value.

    PyMongo cannot directly encode decimal.Decimal.
    Float is sufficient for the prototype because weight is limited
    to two decimal places by the serializer.
    """

    return float(value)


def get_all_transformations():
    collection = get_transformations_collection()

    return list(
        collection.find().sort(
            [
                ("recorded_date", -1),
                ("created_at", -1),
            ]
        )
    )


def get_transformations_by_member(member_id):
    collection = get_transformations_collection()

    return list(
        collection.find(
            {
                "member_id": member_id,
            }
        ).sort(
            [
                ("week_number", -1),
                ("recorded_date", -1),
            ]
        )
    )


def get_transformation_by_member_and_week(
    member_id,
    week_number,
):
    collection = get_transformations_collection()

    return collection.find_one(
        {
            "member_id": member_id,
            "week_number": week_number,
        }
    )


def get_transformation_by_id(transformation_id):
    collection = get_transformations_collection()

    if not ObjectId.is_valid(transformation_id):
        return None

    return collection.find_one(
        {
            "_id": ObjectId(transformation_id),
        }
    )


def create_transformation(data):
    collection = get_transformations_collection()

    now = utc_now()

    document = {
        "member_id": data["member_id"],
        "week_number": data["week_number"],
        "recorded_date": normalize_recorded_date(
            data["recorded_date"]
        ),
        "weight_kg": normalize_weight(
            data["weight_kg"]
        ),
        "image_url": data.get(
            "image_url",
            "",
        ),
        "notes": data.get(
            "notes",
            "",
        ),
        "created_at": now,
        "updated_at": now,
    }

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return document


def update_transformation(
    transformation_id,
    data,
):
    collection = get_transformations_collection()

    if not ObjectId.is_valid(transformation_id):
        return None

    object_id = ObjectId(transformation_id)

    existing = collection.find_one(
        {
            "_id": object_id,
        }
    )

    if existing is None:
        return None

    update_fields = {}

    if "member_id" in data:
        update_fields["member_id"] = data["member_id"]

    if "week_number" in data:
        update_fields["week_number"] = data["week_number"]

    if "recorded_date" in data:
        update_fields["recorded_date"] = (
            normalize_recorded_date(
                data["recorded_date"]
            )
        )

    if "weight_kg" in data:
        update_fields["weight_kg"] = normalize_weight(
            data["weight_kg"]
        )

    if "image_url" in data:
        update_fields["image_url"] = data["image_url"]

    if "notes" in data:
        update_fields["notes"] = data["notes"]

    update_fields["updated_at"] = utc_now()

    collection.update_one(
        {
            "_id": object_id,
        },
        {
            "$set": update_fields,
        },
    )

    return collection.find_one(
        {
            "_id": object_id,
        }
    )


def delete_transformation(transformation_id):
    collection = get_transformations_collection()

    if not ObjectId.is_valid(transformation_id):
        return False

    result = collection.delete_one(
        {
            "_id": ObjectId(transformation_id),
        }
    )

    return result.deleted_count == 1


def ensure_transformation_indexes():
    collection = get_transformations_collection()

    collection.create_index(
        [
            ("member_id", 1),
            ("week_number", 1),
        ],
        unique=True,
        name="member_week_unique",
    )

    collection.create_index(
        [
            ("member_id", 1),
            ("recorded_date", -1),
        ],
        name="member_recorded_date",
    )
