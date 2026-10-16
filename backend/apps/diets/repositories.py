from datetime import datetime, timezone

from apps.diets.database import (
    get_diet_assignments_collection,
    get_diet_templates_collection,
)


def utc_now():
    return datetime.now(timezone.utc)


def normalize_meals(meals):
    normalized = []

    for meal in meals:
        normalized_items = []

        for item in meal.get("items", []):
            normalized_items.append(
                {
                    "name": item["name"],
                    "quantity": item.get("quantity", ""),
                    "notes": item.get("notes", ""),
                }
            )

        normalized.append(
            {
                "name": meal["name"],
                "meal_type": meal["meal_type"],
                "items": normalized_items,
            }
        )

    return normalized


def get_all_diet_templates():
    collection = get_diet_templates_collection()

    return list(
        collection.find().sort(
            [
                ("name", 1),
            ]
        )
    )


def get_diet_template_by_key(template_key):
    collection = get_diet_templates_collection()

    return collection.find_one(
        {
            "template_key": template_key,
        }
    )


def create_diet_template(data):
    collection = get_diet_templates_collection()

    now = utc_now()

    document = {
        "template_key": data["template_key"],
        "name": data["name"],
        "description": data.get("description", ""),
        "target_calories": data.get("target_calories"),
        "meals": normalize_meals(
            data.get("meals", [])
        ),
        "created_at": now,
        "updated_at": now,
    }

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return document


def get_all_diet_assignments():
    collection = get_diet_assignments_collection()

    return list(
        collection.find().sort(
            [
                ("assigned_date", -1),
                ("created_at", -1),
            ]
        )
    )


def get_diet_assignment_by_id(assignment_id):
    collection = get_diet_assignments_collection()

    return collection.find_one(
        {
            "_id": assignment_id,
        }
    )


def create_diet_assignment(data):
    collection = get_diet_assignments_collection()

    now = utc_now()

    assigned_date = data["assigned_date"]

    # DRF DateField returns datetime.date.
    # MongoDB BSON requires datetime.datetime.
    if hasattr(assigned_date, "year") and not isinstance(
        assigned_date,
        datetime,
    ):
        assigned_date = datetime(
            assigned_date.year,
            assigned_date.month,
            assigned_date.day,
            tzinfo=timezone.utc,
        )

    document = {
        "member_id": data["member_id"],
        "template_key": data["template_key"],
        "assigned_date": assigned_date,
        "status": data.get(
            "status",
            "active",
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
