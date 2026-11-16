import copy
from datetime import date, datetime, timedelta, timezone

from django.utils import timezone as django_timezone
from pymongo.errors import DuplicateKeyError

from apps.members.repository import get_member_by_id

from ..database import (
    get_assignment_history_collection,
    get_assignments_collection,
    get_sessions_collection,
)
from ..programs.repositories import program_detail
from ..programs.validation import normalize_days


WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
WEEKDAY_ALIASES = {
    "monday": "mon",
    "tuesday": "tue",
    "wednesday": "wed",
    "thursday": "thu",
    "friday": "fri",
    "saturday": "sat",
    "sunday": "sun",
}
MODES = {"rotation", "fixed_week"}


class AssignmentError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


def _now():
    return datetime.now(timezone.utc)


def _iso(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def gym_date():
    return django_timezone.localdate()


def gym_date_string():
    return gym_date().isoformat()


def parse_date(value, field="start_date"):
    if isinstance(value, datetime):
        return value.date().isoformat()

    if isinstance(value, date):
        return value.isoformat()

    text = str(value or "").strip()

    try:
        return date.fromisoformat(text).isoformat()
    except ValueError as exc:
        raise AssignmentError(
            f"{field} must use the YYYY-MM-DD format."
        ) from exc


def get_member(member_id):
    return get_member_by_id(str(member_id))


def get_active_assignment(member_id):
    return get_assignments_collection().find_one(
        {"member_id": str(member_id), "status": "active"}
    )


def normalize_weekday_map(raw_map, days):
    if not isinstance(raw_map, dict):
        raise AssignmentError(
            "weekday_map is required for fixed-week assignments."
        )

    valid_day_keys = {day.get("day_key") for day in days}
    normalized = {}

    for raw_key, raw_value in raw_map.items():
        key = str(raw_key or "").strip().lower()
        key = WEEKDAY_ALIASES.get(key, key)

        if key not in WEEKDAYS:
            raise AssignmentError(
                f"Unknown weekday in weekday_map: {raw_key}."
            )

        value = str(raw_value or "").strip()

        if value.lower() in {"", "rest", "none", "null"}:
            continue

        if value not in valid_day_keys:
            raise AssignmentError(
                f"weekday_map references an unknown day_key: {value}."
            )

        normalized[key] = value

    if not normalized:
        raise AssignmentError(
            "weekday_map must schedule at least one training day."
        )

    return normalized


def _snapshot(assignment):
    return {
        "program_id": str(assignment.get("program_id", "")),
        "program_source_name": assignment.get("program_source_name", ""),
        "mode": assignment.get("mode"),
        "weekday_map": assignment.get("weekday_map") or {},
        "pointer": assignment.get("pointer"),
        "start_date": assignment.get("start_date"),
        "revision": assignment.get("revision"),
        "status": assignment.get("status"),
    }


def append_history(
    member_id,
    assignment_id,
    changed_by,
    change_type,
    old_value,
    new_value,
    notes="",
):
    get_assignment_history_collection().insert_one(
        {
            "assignment_id": str(assignment_id),
            "member_id": str(member_id),
            "changed_by": changed_by,
            "change_type": change_type,
            "old_value": old_value,
            "new_value": new_value,
            "notes": notes,
            "changed_at": _now(),
        }
    )


def serialize_assignment(assignment):
    if not assignment:
        return None

    return {
        "id": str(assignment.get("_id", "")),
        "member_id": assignment.get("member_id", ""),
        "program_id": str(assignment.get("program_id", "")),
        "program_source_name": assignment.get("program_source_name", ""),
        "program_version": assignment.get("program_version", 1),
        "program_copy": assignment.get("program_copy", {}),
        "mode": assignment.get("mode", "rotation"),
        "weekday_map": assignment.get("weekday_map") or {},
        "pointer": assignment.get("pointer"),
        "revision": assignment.get("revision", 1),
        "start_date": assignment.get("start_date"),
        "status": assignment.get("status", "active"),
        "created_by": assignment.get("created_by"),
        "created_at": _iso(assignment.get("created_at")),
        "updated_at": _iso(assignment.get("updated_at")),
        "ended_at": _iso(assignment.get("ended_at")),
    }


def serialize_history(record):
    return {
        "id": str(record.get("_id", "")),
        "assignment_id": record.get("assignment_id", ""),
        "member_id": record.get("member_id", ""),
        "changed_by": record.get("changed_by", ""),
        "change_type": record.get("change_type", ""),
        "old_value": record.get("old_value"),
        "new_value": record.get("new_value"),
        "notes": record.get("notes", ""),
        "changed_at": _iso(record.get("changed_at")),
    }


def create_assignment(member_id, data, changed_by):
    member = get_member(member_id)

    if member is None:
        raise AssignmentError("Member not found.", 404)

    if str(member.get("status", "")).lower() != "active":
        raise AssignmentError(
            "Training cannot be assigned to an inactive member.",
            409,
        )

    if not isinstance(data, dict):
        raise AssignmentError("Assignment payload must be an object.")

    program = program_detail(data.get("program_id"))

    if program is None:
        raise AssignmentError("Program not found.", 404)

    if program.get("archived"):
        raise AssignmentError(
            "An archived program cannot be assigned.",
            409,
        )

    mode = str(data.get("mode") or "rotation").strip().lower()

    if mode not in MODES:
        raise AssignmentError("mode must be rotation or fixed_week.")

    days = copy.deepcopy(program.get("days", []))

    if not days:
        raise AssignmentError(
            "This program has no training days to assign."
        )

    weekday_map = {}
    pointer = 0

    if mode == "fixed_week":
        weekday_map = normalize_weekday_map(
            data.get("weekday_map"),
            days,
        )
    else:
        try:
            pointer = int(data.get("pointer") or 0)
        except (TypeError, ValueError) as exc:
            raise AssignmentError(
                "pointer must be a whole number."
            ) from exc

        if pointer < 0:
            raise AssignmentError("pointer cannot be negative.")

        pointer = pointer % len(days)

    start_date = parse_date(
        data.get("start_date") or gym_date_string()
    )

    if get_active_assignment(member_id) is not None:
        raise AssignmentError(
            "Member already has an active assignment.",
            409,
        )

    now = _now()
    document = {
        "member_id": str(member_id),
        "program_id": str(program.get("_id")),
        "program_source_name": program.get("name", ""),
        "program_version": program.get("version", 1),
        "program_copy": {
            "name": program.get("name", ""),
            "goal": program.get("goal", ""),
            "level": program.get("level", ""),
            "days": days,
        },
        "mode": mode,
        "weekday_map": weekday_map,
        "pointer": pointer,
        "revision": 1,
        "start_date": start_date,
        "status": "active",
        "created_by": changed_by,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = get_assignments_collection().insert_one(document)
    except DuplicateKeyError as exc:
        raise AssignmentError(
            "Member already has an active assignment.",
            409,
        ) from exc

    document["_id"] = result.inserted_id

    append_history(
        member_id,
        result.inserted_id,
        changed_by,
        "assign",
        None,
        _snapshot(document),
        notes=data.get("notes", ""),
    )

    return document


def update_assignment(member_id, data, changed_by):
    assignment = get_active_assignment(member_id)

    if assignment is None:
        raise AssignmentError("Active assignment not found.", 404)

    if not isinstance(data, dict):
        raise AssignmentError("Assignment payload must be an object.")

    old_value = _snapshot(assignment)
    update = {}

    current_copy = copy.deepcopy(
        assignment.get("program_copy") or {}
    )
    current_days = copy.deepcopy(current_copy.get("days") or [])

    if "program_id" in data:
        program = program_detail(data.get("program_id"))

        if program is None:
            raise AssignmentError("Program not found.", 404)

        if program.get("archived"):
            raise AssignmentError(
                "An archived program cannot be assigned.",
                409,
            )

        days = copy.deepcopy(program.get("days", []))

        if not days:
            raise AssignmentError(
                "This program has no training days to assign."
            )

        current_days = days
        update["program_id"] = str(program.get("_id"))
        update["program_source_name"] = program.get("name", "")
        update["program_version"] = program.get("version", 1)
        update["program_copy"] = {
            "name": program.get("name", ""),
            "goal": program.get("goal", ""),
            "level": program.get("level", ""),
            "days": days,
        }
        update["pointer"] = 0
        update["weekday_map"] = {}

    if "program_copy" in data:
        raw_copy = data.get("program_copy")

        if not isinstance(raw_copy, dict):
            raise AssignmentError(
                "program_copy must be an object."
            )

        days = normalize_days(raw_copy.get("days"))

        if not days:
            raise AssignmentError(
                "The member's program copy needs at least one day."
            )

        current_days = days
        update["program_copy"] = {
            "name": str(
                raw_copy.get("name")
                or current_copy.get("name")
                or ""
            ),
            "goal": str(
                raw_copy.get("goal")
                or current_copy.get("goal")
                or ""
            ),
            "level": str(
                raw_copy.get("level")
                or current_copy.get("level")
                or ""
            ),
            "days": days,
        }

    mode = str(
        data.get("mode") or assignment.get("mode") or "rotation"
    ).strip().lower()

    if mode not in MODES:
        raise AssignmentError("mode must be rotation or fixed_week.")

    if "mode" in data:
        update["mode"] = mode

    if "weekday_map" in data or mode == "fixed_week":
        raw_map = (
            data.get("weekday_map")
            if "weekday_map" in data
            else assignment.get("weekday_map")
        )

        if mode == "fixed_week":
            update["weekday_map"] = normalize_weekday_map(
                raw_map,
                current_days,
            )
        elif "weekday_map" in data:
            update["weekday_map"] = {}

    if mode == "rotation":
        if data.get("reset_pointer") is True:
            pointer = data.get("pointer", 0)
        elif "pointer" in data:
            pointer = data.get("pointer")
        elif "mode" in data or "program_id" in data:
            pointer = 0
        else:
            pointer = assignment.get("pointer", 0)

        try:
            pointer = int(pointer or 0)
        except (TypeError, ValueError) as exc:
            raise AssignmentError(
                "pointer must be a whole number."
            ) from exc

        if pointer < 0:
            raise AssignmentError("pointer cannot be negative.")

        if current_days:
            pointer = pointer % len(current_days)

        update["pointer"] = pointer

    if "start_date" in data:
        update["start_date"] = parse_date(data.get("start_date"))

    if not update:
        raise AssignmentError(
            "No supported assignment fields were provided."
        )

    update["revision"] = int(assignment.get("revision", 1)) + 1
    update["updated_at"] = _now()

    get_assignments_collection().update_one(
        {"_id": assignment["_id"]},
        {"$set": update},
    )

    updated = get_assignments_collection().find_one(
        {"_id": assignment["_id"]}
    )

    append_history(
        member_id,
        assignment["_id"],
        changed_by,
        "edit",
        old_value,
        _snapshot(updated),
        notes=data.get("notes", ""),
    )

    return updated


def end_assignment(member_id, changed_by):
    assignment = get_active_assignment(member_id)

    if assignment is None:
        raise AssignmentError("Active assignment not found.", 404)

    now = _now()
    get_assignments_collection().update_one(
        {"_id": assignment["_id"]},
        {
            "$set": {
                "status": "ended",
                "ended_at": now,
                "updated_at": now,
            }
        },
    )

    get_sessions_collection().update_many(
        {
            "assignment_id": str(assignment["_id"]),
            "status": "in_progress",
        },
        {
            "$set": {
                "status": "abandoned",
                "abandoned_at": now,
            }
        },
    )

    ended = get_assignments_collection().find_one(
        {"_id": assignment["_id"]}
    )

    append_history(
        member_id,
        assignment["_id"],
        changed_by,
        "end",
        _snapshot(assignment),
        _snapshot(ended),
    )

    return ended


def list_assignments(member_id):
    return list(
        get_assignments_collection()
        .find({"member_id": str(member_id)})
        .sort([("created_at", -1)])
    )


def list_history(member_id):
    return list(
        get_assignment_history_collection()
        .find({"member_id": str(member_id)})
        .sort([("changed_at", -1)])
    )


def adherence(member_id):
    assignment = get_active_assignment(member_id)
    today = gym_date()
    week_start = today - timedelta(days=6)

    sessions = list(
        get_sessions_collection()
        .find(
            {
                "member_id": str(member_id),
                "session_date": {
                    "$gte": week_start.isoformat(),
                    "$lte": today.isoformat(),
                },
            }
        )
        .sort([("session_date", 1)])
    )

    completed = [
        session
        for session in sessions
        if session.get("status") == "completed"
    ]

    expected = 0

    if assignment:
        if assignment.get("mode") == "fixed_week":
            weekday_map = assignment.get("weekday_map") or {}

            for offset in range(7):
                current = week_start + timedelta(days=offset)
                if weekday_map.get(WEEKDAYS[current.weekday()]):
                    expected += 1
        else:
            days = (
                assignment.get("program_copy", {}).get("days")
                or []
            )
            expected = min(7, len(days))

    percentage = (
        round((len(completed) / expected) * 100)
        if expected
        else 0
    )

    return {
        "week_start": week_start.isoformat(),
        "week_end": today.isoformat(),
        "assignment": serialize_assignment(assignment),
        "completed_this_week": len(completed),
        "expected_this_week": expected,
        "adherence_pct": percentage,
        "sessions": [
            {
                "id": str(session.get("_id", "")),
                "session_date": session.get("session_date"),
                "day_key": session.get("day_key"),
                "status": session.get("status"),
                "completed_at": _iso(session.get("completed_at")),
            }
            for session in sessions
        ],
    }
