import copy
import uuid
from datetime import date, datetime, timezone

from bson import ObjectId
from django.utils import timezone as django_timezone
from pymongo.errors import DuplicateKeyError

from apps.members.repository import get_member_by_id

from ..assignments.repositories import (
    WEEKDAYS,
    append_history,
    get_active_assignment,
    serialize_assignment,
)
from ..database import get_assignments_collection, get_sessions_collection


class SessionError(Exception):
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


def _object_id(value):
    try:
        return ObjectId(str(value))
    except Exception:
        return None


def _optional_int(value, field):
    if value is None or value == "":
        return None

    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise SessionError(f"{field} must be a whole number.") from exc


def _optional_float(value, field):
    if value is None or value == "":
        return None

    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise SessionError(f"{field} must be a number.") from exc


def _optional_bool(value):
    if isinstance(value, bool):
        return value

    return str(value).lower() in {"1", "true", "yes", "on"}


def _require_active_member(member_id):
    member = get_member_by_id(str(member_id))

    if member is None:
        raise SessionError("Member not found.", 404)

    if str(member.get("status", "")).lower() != "active":
        raise SessionError("This member account is inactive.", 403)

    return member


def serialize_session(session):
    if not session:
        return None

    return {
        "id": str(session.get("_id", "")),
        "assignment_id": str(session.get("assignment_id", "")),
        "member_id": session.get("member_id", ""),
        "session_date": session.get("session_date"),
        "day_key": session.get("day_key"),
        "day_index": session.get("day_index"),
        "day_snapshot": session.get("day_snapshot", {}),
        "exercises": session.get("exercises", []),
        "status": session.get("status", "in_progress"),
        "advanced": bool(session.get("advanced", False)),
        "pointer_at_start": session.get("pointer_at_start"),
        "started_at": _iso(session.get("started_at")),
        "completed_at": _iso(session.get("completed_at")),
        "abandoned_at": _iso(session.get("abandoned_at")),
        "client_uuid": session.get("client_uuid"),
        "corrections": session.get("corrections", []),
    }


def serialize_session_summary(session):
    exercises = session.get("exercises") or []
    set_count = sum(
        len(exercise.get("sets") or []) for exercise in exercises
    )
    completed_sets = sum(
        1
        for exercise in exercises
        for set_entry in exercise.get("sets") or []
        if set_entry.get("done")
    )
    day_snapshot = session.get("day_snapshot") or {}

    return {
        "id": str(session.get("_id", "")),
        "session_date": session.get("session_date"),
        "day_key": session.get("day_key"),
        "day_label": day_snapshot.get("label", session.get("day_key")),
        "status": session.get("status"),
        "started_at": _iso(session.get("started_at")),
        "completed_at": _iso(session.get("completed_at")),
        "exercise_count": len(exercises),
        "set_count": set_count,
        "completed_sets": completed_sets,
    }


def _sorted_days(assignment):
    days = (
        assignment.get("program_copy", {}).get("days")
        or []
    )

    return sorted(
        days,
        key=lambda day: (
            day.get("order", 0),
            day.get("day_key", ""),
        ),
    )


def resolve_day(assignment, target_date):
    """Resolve the training day for a gym date.

    Fixed week uses weekday_map. Rotation uses the pointer. Returns None for
    a rest day or when the assignment has not started yet.
    """

    if target_date.isoformat() < str(assignment.get("start_date") or ""):
        return None

    days = _sorted_days(assignment)

    if not days:
        return None

    if assignment.get("mode") == "fixed_week":
        weekday_map = assignment.get("weekday_map") or {}
        day_key = weekday_map.get(WEEKDAYS[target_date.weekday()])

        if not day_key:
            return None

        return next(
            (day for day in days if day.get("day_key") == day_key),
            None,
        )

    try:
        pointer = int(assignment.get("pointer") or 0)
    except (TypeError, ValueError):
        pointer = 0

    return days[pointer % len(days)]


def _session_for_date(member_id, session_date):
    return get_sessions_collection().find_one(
        {
            "member_id": str(member_id),
            "session_date": session_date,
        }
    )


def repair_completed_advancements(member_id, assignment):
    """Repair a completed session that never advanced the pointer."""

    sessions = get_sessions_collection()
    assignments = get_assignments_collection()
    completed = list(
        sessions.find(
            {
                "member_id": str(member_id),
                "assignment_id": str(assignment["_id"]),
                "status": "completed",
                "advanced": False,
            }
        ).sort([("session_date", 1)])
    )

    for session in completed:
        if assignment.get("mode") == "rotation":
            expected_pointer = session.get("pointer_at_start")

            if expected_pointer is not None:
                assignments.update_one(
                    {
                        "_id": assignment["_id"],
                        "status": "active",
                        "pointer": expected_pointer,
                    },
                    {"$inc": {"pointer": 1}},
                )

        sessions.update_one(
            {"_id": session["_id"], "advanced": False},
            {"$set": {"advanced": True}},
        )

    return get_assignments_collection().find_one(
        {"_id": assignment["_id"]}
    )


def abandon_stale_sessions(member_id, today=None):
    today = today or gym_date_string()

    get_sessions_collection().update_many(
        {
            "member_id": str(member_id),
            "status": "in_progress",
            "session_date": {"$lt": today},
        },
        {
            "$set": {
                "status": "abandoned",
                "abandoned_at": _now(),
            }
        },
    )


def get_today(member_id):
    _require_active_member(member_id)
    assignment = get_active_assignment(member_id)

    if assignment is None:
        return {
            "assignment": None,
            "day": None,
            "session": None,
            "rest_day": False,
            "not_started": False,
            "completed_today": False,
            "today": gym_date_string(),
        }

    assignment = repair_completed_advancements(
        member_id,
        assignment,
    )
    abandon_stale_sessions(member_id)

    today = gym_date()
    session = _session_for_date(member_id, today.isoformat())
    day = resolve_day(assignment, today)

    return {
        "assignment": serialize_assignment(assignment),
        "day": day,
        "session": serialize_session(session),
        "rest_day": day is None,
        "not_started": (
            today.isoformat()
            < str(assignment.get("start_date") or "")
        ),
        "completed_today": bool(
            session and session.get("status") == "completed"
        ),
        "today": today.isoformat(),
    }


def _build_exercises(day):
    exercises = []

    for block in day.get("blocks") or []:
        sets = []

        for index, set_definition in enumerate(
            block.get("sets") or [],
            start=1,
        ):
            sets.append(
                {
                    "set_no": index,
                    "set_type": set_definition.get(
                        "set_type",
                        "normal",
                    ),
                    "reps": set_definition.get("reps_min", 0),
                    "weight_kg": None,
                    "duration_s": set_definition.get("duration_s"),
                    "rpe": None,
                    "done": False,
                    "client_set_id": None,
                }
            )

        exercises.append(
            {
                "block_id": block.get("block_id"),
                "exercise_id": block.get("exercise_id"),
                "exercise_name": block.get("exercise_name"),
                "tracking_type": block.get(
                    "tracking_type",
                    "weight_reps",
                ),
                "notes": block.get("notes", ""),
                "sets": sets,
            }
        )

    return exercises


def start_session(member_id):
    _require_active_member(member_id)
    assignment = get_active_assignment(member_id)

    if assignment is None:
        raise SessionError(
            "You do not have an active training assignment.",
            409,
        )

    assignment = repair_completed_advancements(
        member_id,
        assignment,
    )
    abandon_stale_sessions(member_id)

    today = gym_date()

    if today.isoformat() < str(assignment.get("start_date") or ""):
        raise SessionError(
            "This training assignment has not started yet.",
            409,
        )

    existing = _session_for_date(member_id, today.isoformat())

    if existing is not None:
        return existing

    day = resolve_day(assignment, today)

    if day is None:
        raise SessionError("Today is a rest day.", 409)

    days = _sorted_days(assignment)
    day_index = next(
        (
            index
            for index, item in enumerate(days)
            if item.get("day_key") == day.get("day_key")
        ),
        0,
    )

    now = _now()
    session = {
        "assignment_id": str(assignment["_id"]),
        "member_id": str(member_id),
        "session_date": today.isoformat(),
        "day_key": day.get("day_key"),
        "day_index": day_index,
        "day_snapshot": copy.deepcopy(day),
        "exercises": _build_exercises(day),
        "status": "in_progress",
        "advanced": False,
        "pointer_at_start": (
            int(assignment.get("pointer") or 0)
            if assignment.get("mode") == "rotation"
            else None
        ),
        "started_at": now,
        "completed_at": None,
        "abandoned_at": None,
        "client_uuid": str(uuid.uuid4()),
        "corrections": [],
    }

    try:
        result = get_sessions_collection().insert_one(session)
    except DuplicateKeyError:
        return _session_for_date(member_id, today.isoformat())

    session["_id"] = result.inserted_id

    return session


def get_session(member_id, session_id):
    _require_active_member(member_id)
    object_id = _object_id(session_id)

    if object_id is None:
        raise SessionError("Session not found.", 404)

    session = get_sessions_collection().find_one(
        {"_id": object_id, "member_id": str(member_id)}
    )

    if session is None:
        raise SessionError("Session not found.", 404)

    return session


def _normalize_set_payload(data):
    if not isinstance(data, dict):
        raise SessionError("Set payload must be an object.")

    raw_sets = data.get("sets")

    if isinstance(raw_sets, dict):
        raw_sets = [raw_sets]

    if raw_sets is None and isinstance(data.get("set"), dict):
        raw_sets = [data["set"]]

    if raw_sets is None and data.get("client_set_id"):
        raw_sets = [data]

    if not isinstance(raw_sets, list) or not raw_sets:
        raise SessionError("At least one set is required.")

    normalized = []

    for raw_set in raw_sets:
        if not isinstance(raw_set, dict):
            raise SessionError("Each set must be an object.")

        client_set_id = str(
            raw_set.get("client_set_id") or ""
        ).strip()

        if not client_set_id:
            raise SessionError(
                "Every set needs a client_set_id."
            )

        normalized.append(
            {
                "block_id": str(
                    raw_set.get("block_id") or ""
                ).strip(),
                "exercise_id": str(
                    raw_set.get("exercise_id") or ""
                ).strip(),
                "client_set_id": client_set_id,
                "set_no": _optional_int(
                    raw_set.get("set_no"),
                    "set_no",
                ),
                "set_type": str(
                    raw_set.get("set_type") or "normal"
                ).strip(),
                "reps": _optional_int(
                    raw_set.get("reps"),
                    "reps",
                ),
                "weight_kg": _optional_float(
                    raw_set.get("weight_kg", raw_set.get("weight")),
                    "weight_kg",
                ),
                "duration_s": _optional_int(
                    raw_set.get("duration_s"),
                    "duration_s",
                ),
                "rpe": _optional_float(
                    raw_set.get("rpe"),
                    "rpe",
                ),
                "done": _optional_bool(raw_set.get("done", True)),
            }
        )

    return normalized


def log_sets(member_id, session_id, data):
    _require_active_member(member_id)
    object_id = _object_id(session_id)

    if object_id is None:
        raise SessionError("Session not found.", 404)

    session = get_sessions_collection().find_one(
        {"_id": object_id, "member_id": str(member_id)}
    )

    if session is None:
        raise SessionError("Session not found.", 404)

    if session.get("status") == "completed":
        raise SessionError(
            "Completed sessions are immutable. Staff can append a correction.",
            409,
        )

    if session.get("status") == "abandoned":
        raise SessionError(
            "Abandoned sessions cannot accept new sets.",
            409,
        )

    sets = _normalize_set_payload(data)
    applied = 0

    for set_payload in sets:
        block = next(
            (
                exercise
                for exercise in session.get("exercises") or []
                if (
                    set_payload["block_id"]
                    and exercise.get("block_id")
                    == set_payload["block_id"]
                )
                or (
                    not set_payload["block_id"]
                    and set_payload["exercise_id"]
                    and exercise.get("exercise_id")
                    == set_payload["exercise_id"]
                )
            ),
            None,
        )

        if block is None:
            raise SessionError(
                "The exercise is not part of this session."
            )

        set_no = set_payload["set_no"]

        if set_no is None:
            set_no = len(block.get("sets") or []) + 1

        set_document = {
            "set_no": set_no,
            "set_type": set_payload["set_type"],
            "reps": set_payload["reps"],
            "weight_kg": set_payload["weight_kg"],
            "duration_s": set_payload["duration_s"],
            "rpe": set_payload["rpe"],
            "done": set_payload["done"],
            "client_set_id": set_payload["client_set_id"],
        }

        result = get_sessions_collection().update_one(
            {
                "_id": object_id,
                "member_id": str(member_id),
                "status": "in_progress",
                "exercises.sets.client_set_id": {
                    "$ne": set_payload["client_set_id"]
                },
            },
            {
                "$push": {
                    "exercises.$[block].sets": set_document,
                }
            },
            array_filters=[
                {"block.block_id": block.get("block_id")}
            ],
        )

        if result.modified_count:
            applied += 1
            block.setdefault("sets", []).append(set_document)
            continue

        current = get_sessions_collection().find_one(
            {"_id": object_id}
        )

        if current is None:
            raise SessionError("Session not found.", 404)

        if current.get("status") == "completed":
            raise SessionError(
                "Completed sessions are immutable.",
                409,
            )

        duplicate = any(
            set_entry.get("client_set_id")
            == set_payload["client_set_id"]
            for exercise in current.get("exercises") or []
            for set_entry in exercise.get("sets") or []
        )

        if not duplicate:
            raise SessionError("Could not log this set.")

    session = get_sessions_collection().find_one(
        {"_id": object_id}
    )

    return session, applied


def complete_session(member_id, session_id):
    _require_active_member(member_id)
    object_id = _object_id(session_id)

    if object_id is None:
        raise SessionError("Session not found.", 404)

    session = get_sessions_collection().find_one(
        {"_id": object_id, "member_id": str(member_id)}
    )

    if session is None:
        raise SessionError("Session not found.", 404)

    if session.get("status") == "completed":
        return session, True

    if session.get("status") == "abandoned":
        raise SessionError(
            "Abandoned sessions cannot be completed.",
            409,
        )

    result = get_sessions_collection().update_one(
        {
            "_id": object_id,
            "member_id": str(member_id),
            "status": "in_progress",
        },
        {
            "$set": {
                "status": "completed",
                "completed_at": _now(),
            }
        },
    )

    if result.modified_count == 0:
        current = get_sessions_collection().find_one(
            {"_id": object_id}
        )

        if current and current.get("status") == "completed":
            return current, True

        raise SessionError("Could not complete this session.", 409)

    assignment_object_id = _object_id(
        session.get("assignment_id")
    )
    assignment = (
        get_assignments_collection().find_one(
            {"_id": assignment_object_id}
        )
        if assignment_object_id
        else None
    )

    if (
        assignment
        and assignment.get("mode") == "rotation"
        and session.get("pointer_at_start") is not None
    ):
        get_assignments_collection().update_one(
            {
                "_id": assignment["_id"],
                "status": "active",
                "pointer": session.get("pointer_at_start"),
            },
            {"$inc": {"pointer": 1}},
        )

    get_sessions_collection().update_one(
        {"_id": object_id, "advanced": False},
        {"$set": {"advanced": True}},
    )

    return (
        get_sessions_collection().find_one({"_id": object_id}),
        False,
    )


def history(member_id):
    _require_active_member(member_id)

    sessions = list(
        get_sessions_collection()
        .find({"member_id": str(member_id)})
        .sort([("session_date", -1), ("started_at", -1)])
    )

    return [serialize_session_summary(session) for session in sessions]


def last_exercise(member_id, exercise_id):
    _require_active_member(member_id)

    sessions = list(
        get_sessions_collection()
        .find(
            {
                "member_id": str(member_id),
                "status": "completed",
                "exercises.exercise_id": exercise_id,
            }
        )
        .sort([("completed_at", -1)])
    )

    for session in sessions:
        exercise = next(
            (
                item
                for item in session.get("exercises") or []
                if item.get("exercise_id") == exercise_id
            ),
            None,
        )

        if exercise is None or not exercise.get("sets"):
            continue

        sets = exercise["sets"]
        last_set = sets[-1]

        return {
            "exercise_id": exercise_id,
            "exercise_name": exercise.get("exercise_name"),
            "session_id": str(session.get("_id", "")),
            "session_date": session.get("session_date"),
            "sets": sets,
            "last_set": last_set,
        }

    return None


def plan(member_id):
    _require_active_member(member_id)
    assignment = get_active_assignment(member_id)

    if assignment is None:
        return {"assignment": None, "days": []}

    return {
        "assignment": serialize_assignment(assignment),
        "days": (
            assignment.get("program_copy", {}).get("days")
            or []
        ),
        "mode": assignment.get("mode"),
        "weekday_map": assignment.get("weekday_map") or {},
        "pointer": assignment.get("pointer"),
        "start_date": assignment.get("start_date"),
    }


def add_correction(session_id, staff_username, data):
    object_id = _object_id(session_id)

    if object_id is None:
        raise SessionError("Session not found.", 404)

    session = get_sessions_collection().find_one(
        {"_id": object_id}
    )

    if session is None:
        raise SessionError("Session not found.", 404)

    if not isinstance(data, dict):
        raise SessionError("Correction payload must be an object.")

    reason = str(data.get("reason") or "").strip()

    if not reason:
        raise SessionError("A correction reason is required.")

    correction = {
        "at": _now(),
        "by": staff_username,
        "reason": reason,
        "patch": data.get("patch") or {},
    }

    get_sessions_collection().update_one(
        {"_id": object_id},
        {"$push": {"corrections": correction}},
    )

    append_history(
        session.get("member_id"),
        session.get("assignment_id"),
        staff_username,
        "correction",
        None,
        {
            "session_id": str(object_id),
            "reason": reason,
            "patch": correction["patch"],
        },
    )

    return get_sessions_collection().find_one({"_id": object_id})
