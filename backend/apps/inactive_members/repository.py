from datetime import datetime, time

from django.utils import timezone

from apps.attendance.database import get_attendance_collection
from apps.members.database import get_members_collection


INACTIVE_AFTER_DAYS = 3


def _normalize_date(value):
    if isinstance(value, datetime):
        return value.date()

    if hasattr(value, "year"):
        return value

    return value


def _get_reference_date(member_id, joining_date):
    attendance_collection = get_attendance_collection()

    latest_attendance = attendance_collection.find_one(
        {
            "member_id": member_id,
        },
        sort=[
            ("attendance_date", -1),
            ("created_at", -1),
        ],
    )

    if latest_attendance:
        return _normalize_date(
            latest_attendance["attendance_date"]
        )

    return _normalize_date(joining_date)


def get_inactive_member_candidates():
    members_collection = get_members_collection()

    today = timezone.localdate()

    active_members = members_collection.find(
        {
            "status": "active",
        }
    )

    candidates = []

    for member in active_members:
        member_id = member["member_id"]

        reference_date = _get_reference_date(
            member_id,
            member.get("joining_date"),
        )

        if reference_date is None:
            continue

        days_since_attendance = (
            today - reference_date
        ).days

        if days_since_attendance < INACTIVE_AFTER_DAYS:
            continue

        candidates.append(
            {
                "member_id": member_id,
                "name": member.get("name", ""),
                "phone": member.get("phone", ""),
                "status": member.get("status"),
                "last_attendance_date": (
                    reference_date.isoformat()
                ),
                "days_since_attendance": days_since_attendance,
                "inactive_threshold_days": (
                    INACTIVE_AFTER_DAYS
                ),
            }
        )

    candidates.sort(
        key=lambda item: item["days_since_attendance"],
        reverse=True,
    )

    return candidates