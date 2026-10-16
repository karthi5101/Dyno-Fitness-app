from datetime import datetime

from apps.attendance.database import get_attendance_collection
from apps.members.database import get_members_collection
from apps.gym_sessions.database import get_sessions_collection


SESSION_SLOTS = [
    {
        "session_id": "MORNING-1",
        "session": "morning",
        "half": "first",
        "start_time": "05:30",
        "end_time": "07:30",
    },
    {
        "session_id": "MORNING-2",
        "session": "morning",
        "half": "second",
        "start_time": "07:30",
        "end_time": "09:30",
    },
    {
        "session_id": "EVENING-1",
        "session": "evening",
        "half": "first",
        "start_time": "17:30",
        "end_time": "19:30",
    },
    {
        "session_id": "EVENING-2",
        "session": "evening",
        "half": "second",
        "start_time": "19:30",
        "end_time": "21:30",
    },
]


def get_session_slots():
    return SESSION_SLOTS


def get_session_by_id(session_id):
    for session in SESSION_SLOTS:
        if session["session_id"] == session_id:
            return session

    return None


def get_expected_members(session_id):
    collection = get_members_collection()

    session = get_session_by_id(session_id)

    if session is None:
        return []

    members = list(
        collection.find(
            {"status": "active"},
            {
                "_id": 0,
                "member_id": 1,
                "name": 1,
            },
        ).sort("member_id", 1)
    )

    return members


def get_present_members(attendance_date):
    collection = get_attendance_collection()

    start = datetime.combine(
        attendance_date,
        datetime.min.time(),
    )

    end = datetime.combine(
        attendance_date,
        datetime.max.time(),
    )

    records = list(
        collection.find(
            {
                "attendance_date": {
                    "$gte": start,
                    "$lte": end,
                },
                "status": "present",
            },
            {
                "_id": 0,
                "member_id": 1,
            },
        )
    )

    member_ids = [
        record["member_id"]
        for record in records
    ]

    if not member_ids:
        return []

    members = list(
        get_members_collection().find(
            {
                "member_id": {
                    "$in": member_ids,
                },
            },
            {
                "_id": 0,
                "member_id": 1,
                "name": 1,
            },
        ).sort("member_id", 1)
    )

    return members


def get_session_summary(session_id, attendance_date):
    session = get_session_by_id(session_id)

    if session is None:
        return None

    expected_members = get_expected_members(session_id)
    present_members = get_present_members(attendance_date)

    present_ids = {
        member["member_id"]
        for member in present_members
    }

    expected_ids = {
        member["member_id"]
        for member in expected_members
    }

    expected_present_members = [
        member
        for member in expected_members
        if member["member_id"] in present_ids
    ]

    expected_count = len(expected_members)
    present_count = len(
        [
            member
            for member in present_members
            if member["member_id"] in expected_ids
        ]
    )

    return {
        "session_id": session["session_id"],
        "session": session["session"],
        "half": session["half"],
        "start_time": session["start_time"],
        "end_time": session["end_time"],
        "expected_count": expected_count,
        "present_count": present_count,
        "expected_members": expected_members,
        "present_members": expected_present_members,
    }


def save_session_configuration():
    collection = get_sessions_collection()

    now = datetime.utcnow()

    for session in SESSION_SLOTS:
        collection.update_one(
            {
                "session_id": session["session_id"],
            },
            {
                "$set": {
                    **session,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                },
            },
            upsert=True,
        )

    return list(
        collection.find(
            {},
            {
                "_id": 0,
            },
        ).sort("session_id", 1)
    )