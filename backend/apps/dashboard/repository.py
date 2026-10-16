from datetime import date, datetime
from decimal import Decimal

from bson import ObjectId

from apps.attendance.repositories import (
    get_today_attendance,
)
from apps.gym_sessions.services import (
    get_session_overview,
)
from apps.inactive_members.repository import (
    get_inactive_member_candidates,
)
from apps.members.repository import (
    get_all_members,
)
from apps.membership.payment_repository import (
    get_all_payments,
)
from apps.membership.repository import (
    get_all_memberships,
)
from apps.transformations.repositories import (
    get_all_transformations,
)


def _serialize_value(value):
    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, date):
        return value.isoformat()

    if isinstance(value, list):
        return [
            _serialize_value(item)
            for item in value
        ]

    if isinstance(value, dict):
        return {
            key: _serialize_value(item)
            for key, item in value.items()
        }

    return value


def _serialize_documents(documents):
    return [
        _serialize_value(document)
        for document in documents
    ]


def get_dashboard_data(target_date=None):
    if target_date is None:
        target_date = date.today()

    members = get_all_members()

    active_members = [
        member
        for member in members
        if member.get("status") == "active"
    ]

    inactive_members = [
        member
        for member in members
        if member.get("status") == "inactive"
    ]

    today_attendance = get_today_attendance()

    session_overview = get_session_overview(
        target_date
    )

    inactive_candidates = (
        get_inactive_member_candidates()
    )

    memberships = get_all_memberships()

    active_memberships = [
        membership
        for membership in memberships
        if membership.get("status") == "active"
    ]

    payments = get_all_payments()

    recent_payments = payments[:10]

    transformations = get_all_transformations()

    recent_transformations = transformations[:10]

    return _serialize_value(
        {
            "date": target_date,
            "members": {
                "total": len(members),
                "active": len(active_members),
                "inactive": len(inactive_members),
            },
            "attendance": {
                "today_present": len(today_attendance),
                "today_records": today_attendance,
            },
            "sessions": session_overview,
            "inactive_members": inactive_candidates,
            "membership": {
                "active_count": len(active_memberships),
            },
            "payments": {
                "recent": recent_payments,
            },
            "transformations": {
                "recent": recent_transformations,
            },
        }
    )