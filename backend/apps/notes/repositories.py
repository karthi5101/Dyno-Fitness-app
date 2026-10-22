from datetime import datetime, timezone

from bson import ObjectId

from apps.members.database import get_members_collection
from apps.notes.database import get_notes_collection


def utc_now():
    return datetime.now(timezone.utc)


def member_exists(member_id):
    collection = get_members_collection()

    return collection.find_one(
        {
            "member_id": member_id,
        },
        {
            "_id": 1,
        },
    ) is not None


def get_notes_by_member(member_id):
    collection = get_notes_collection()

    return list(
        collection.find(
            {
                "member_id": member_id,
            }
        ).sort(
            [
                ("created_at", -1),
            ]
        )
    )


def get_note_by_id(note_id):
    collection = get_notes_collection()

    if not ObjectId.is_valid(note_id):
        return None

    return collection.find_one(
        {
            "_id": ObjectId(note_id),
        }
    )


def create_note(data, created_by=""):
    collection = get_notes_collection()

    now = utc_now()

    document = {
        "member_id": data["member_id"],
        "title": data.get("title", ""),
        "body": data.get("body", ""),
        "created_by": created_by,
        "created_at": now,
        "updated_at": now,
    }

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return document


def update_note(note_id, data):
    collection = get_notes_collection()

    if not ObjectId.is_valid(note_id):
        return None

    update_data = {}

    if "title" in data:
        update_data["title"] = data["title"]

    if "body" in data:
        update_data["body"] = data["body"]

    if not update_data:
        return get_note_by_id(note_id)

    update_data["updated_at"] = utc_now()

    result = collection.update_one(
        {
            "_id": ObjectId(note_id),
        },
        {
            "$set": update_data,
        },
    )

    if result.matched_count == 0:
        return None

    return collection.find_one(
        {
            "_id": ObjectId(note_id),
        }
    )


def delete_note(note_id):
    collection = get_notes_collection()

    if not ObjectId.is_valid(note_id):
        return False

    result = collection.delete_one(
        {
            "_id": ObjectId(note_id),
        }
    )

    return result.deleted_count > 0
