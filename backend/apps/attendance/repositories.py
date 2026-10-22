from datetime import datetime, time

from bson import ObjectId
from django.utils import timezone

from apps.attendance.database import get_attendance_collection
from apps.members.database import get_members_collection


def member_exists(member_id):
    collection = get_members_collection()

    return collection.find_one(
        {"member_id": member_id},
        {"_id": 1},
    ) is not None


def get_member(member_id):
    collection = get_members_collection()

    return collection.find_one(
        {"member_id": member_id}
    )


def attendance_exists_for_member_date(
    member_id,
    attendance_date,
    exclude_id=None,
):
    collection = get_attendance_collection()

    query = {
        "member_id": member_id,
        "attendance_date": attendance_date,
    }

    if exclude_id and ObjectId.is_valid(exclude_id):
        query["_id"] = {"$ne": ObjectId(exclude_id)}

    return collection.find_one(
        query,
        {"_id": 1},
    ) is not None


def normalize_attendance_date(attendance_date):
    if hasattr(attendance_date, "year") and not isinstance(
        attendance_date,
        datetime,
    ):
        return datetime.combine(
            attendance_date,
            time.min,
        )

    return attendance_date


def create_attendance(data):
    collection = get_attendance_collection()

    member_id = data["member_id"]

    member = get_member(member_id)

    if member is None:
        raise ValueError("Member not found.")

    raw_attendance_date = data.get("attendance_date")

    if raw_attendance_date is None:
        raw_attendance_date = timezone.localdate()

    attendance_date = normalize_attendance_date(
        raw_attendance_date
    )

    if attendance_exists_for_member_date(
        member_id,
        attendance_date,
    ):
        raise ValueError(
            "Attendance already exists for this member on this date."
        )

    now = timezone.now()

    document = {
        "member_id": member_id,
        "attendance_date": attendance_date,
        "check_in_time": data.get("check_in_time"),
        "status": data.get("status", "present"),
        "notes": data.get("notes"),
        "created_at": now,
        "updated_at": now,
    }

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return document


def create_scan_attendance(member_id):
    member = get_member(member_id)

    if member is None:
        raise ValueError("Member not found.")

    if member.get("status") != "active":
        raise ValueError(
            "Member is inactive and cannot check in."
        )

    today = timezone.localdate()

    attendance_date = datetime.combine(
        today,
        time.min,
    )

    if attendance_exists_for_member_date(
        member_id,
        attendance_date,
    ):
        raise ValueError(
            "Member has already checked in today."
        )

    check_in_time = timezone.now()

    now = timezone.now()

    document = {
        "member_id": member_id,
        "attendance_date": attendance_date,
        "check_in_time": check_in_time,
        "status": "present",
        "notes": "Scan check-in",
        "created_at": now,
        "updated_at": now,
    }

    collection = get_attendance_collection()

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return document


def get_attendance_list():
    collection = get_attendance_collection()

    return list(
        collection.find().sort(
            [
                ("attendance_date", -1),
                ("created_at", -1),
            ]
        )
    )


def get_attendance_by_member(member_id):
    collection = get_attendance_collection()

    return list(
        collection.find(
            {"member_id": member_id}
        ).sort(
            [
                ("attendance_date", -1),
                ("created_at", -1),
            ]
        )
    )


def get_attendance_by_id(attendance_id):
    collection = get_attendance_collection()

    if not ObjectId.is_valid(attendance_id):
        return None

    return collection.find_one(
        {"_id": ObjectId(attendance_id)}
    )


def update_attendance(attendance_id, data):
    collection = get_attendance_collection()

    if not ObjectId.is_valid(attendance_id):
        return None

    member_id = data["member_id"]

    member = get_member(member_id)

    if member is None:
        raise ValueError("Member not found.")

    existing_record = get_attendance_by_id(
        attendance_id
    )

    raw_attendance_date = data.get("attendance_date")

    if raw_attendance_date is None:
        raw_attendance_date = (
            existing_record.get("attendance_date")
            if existing_record
            else timezone.localdate()
        )

    attendance_date = normalize_attendance_date(
        raw_attendance_date
    )

    if attendance_exists_for_member_date(
        member_id,
        attendance_date,
        exclude_id=attendance_id,
    ):
        raise ValueError(
            "Attendance already exists for this member on this date."
        )

    update_data = {
        "member_id": member_id,
        "attendance_date": attendance_date,
        "check_in_time": data.get("check_in_time"),
        "status": data.get("status", "present"),
        "notes": data.get("notes"),
        "updated_at": timezone.now(),
    }

    result = collection.update_one(
        {"_id": ObjectId(attendance_id)},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        return None

    return collection.find_one(
        {"_id": ObjectId(attendance_id)}
    )


def delete_attendance(attendance_id):
    collection = get_attendance_collection()

    if not ObjectId.is_valid(attendance_id):
        return False

    result = collection.delete_one(
        {"_id": ObjectId(attendance_id)}
    )

    return result.deleted_count > 0

def get_today_attendance():
    collection = get_attendance_collection()

    today = timezone.localdate()

    attendance_date = datetime.combine(
        today,
        time.min,
    )

    return list(
        collection.find(
            {
                "attendance_date": attendance_date,
            }
        ).sort(
            [
                ("check_in_time", -1),
                ("created_at", -1),
            ]
        )
    )