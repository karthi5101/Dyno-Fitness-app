from datetime import datetime, timedelta

from apps.attendance.database import get_attendance_collection
from apps.members.database import get_members_collection

from .models import get_all_session_definitions


def _get_date_range(target_date):
    start = datetime.combine(
        target_date,
        datetime.min.time(),
    )

    end = start + timedelta(days=1)

    return start, end


def _get_expected_members(target_date, session_key):
    collection = get_members_collection()

    return list(
        collection.find(
            {
                "status": "active",
                "preferred_session": session_key,
            },
            {
                "_id": 0,
                "member_id": 1,
                "name": 1,
            },
        ).sort(
            "member_id",
            1,
        )
    )


def _get_present_members(target_date):
    collection = get_attendance_collection()

    start, end = _get_date_range(target_date)

    return list(
        collection.find(
            {
                "attendance_date": {
                    "$gte": start,
                    "$lt": end,
                },
                "status": "present",
            },
            {
                "_id": 0,
                "member_id": 1,
            },
        )
    )


def get_session_summary(target_date):
    session_definitions = get_all_session_definitions()

    present_records = _get_present_members(target_date)

    present_member_ids = {
        record["member_id"]
        for record in present_records
    }

    sessions = []

    for session_key, definition in session_definitions.items():
        expected_members = _get_expected_members(
            target_date,
            session_key,
        )

        expected_member_ids = {
            member["member_id"]
            for member in expected_members
        }

        present_in_session = (
            expected_member_ids
            & present_member_ids
        )

        sessions.append(
            {
                "session_key": session_key,
                "name": definition["name"],
                "period": definition["period"],
                "half": definition["half"],
                "start_time": definition["start_time"],
                "end_time": definition["end_time"],
                "expected_count": len(
                    expected_members
                ),
                "present_count": len(
                    present_in_session
                ),
                "present_members": [
                    member
                    for member in expected_members
                    if member["member_id"]
                    in present_in_session
                ],
            }
        )

    return sessions


def get_session_overview(target_date):
    sessions = get_session_summary(target_date)

    total_present = sum(
        session["present_count"]
        for session in sessions
    )

    total_expected = sum(
        session["expected_count"]
        for session in sessions
    )

    return {
        "date": target_date.isoformat(),
        "total_present": total_present,
        "total_expected": total_expected,
        "sessions": sessions,
    }