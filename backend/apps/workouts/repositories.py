from datetime import date, datetime, time, timezone

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from apps.members.database import get_members_collection
from apps.workouts.database import (
    get_daily_workouts_collection,
    get_workout_assignments_collection,
    get_workout_templates_collection,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def utc_now():
    return datetime.now(timezone.utc)


def normalize_workout_date(workout_date):
    """
    Normalize a workout date to UTC midnight.
    """

    if isinstance(workout_date, datetime):
        if workout_date.tzinfo is None:
            return workout_date.replace(tzinfo=timezone.utc)

        return workout_date.astimezone(timezone.utc).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

    if isinstance(workout_date, date):
        return datetime.combine(
            workout_date,
            time.min,
            tzinfo=timezone.utc,
        )

    raise ValueError("Invalid workout date.")


def normalize_template_id(template_id):
    """
    Accept either a MongoDB ObjectId or a valid ObjectId string.
    """

    if isinstance(template_id, ObjectId):
        return template_id

    if not ObjectId.is_valid(str(template_id)):
        return None

    return ObjectId(str(template_id))


def normalize_object_id(value):
    """
    Accept either a MongoDB ObjectId or a valid ObjectId string.

    Used for daily workout identifiers. Never raises.
    """

    if value is None:
        return None

    if isinstance(value, ObjectId):
        return value

    if not ObjectId.is_valid(str(value)):
        return None

    return ObjectId(str(value))


def normalize_exercises(exercises):
    """
    Normalize exercises into the single storage format used by
    templates and daily workout snapshots.

    Order is rebuilt from the submitted list position.
    """

    if not isinstance(exercises, list):
        raise ValueError("Exercises must be provided as a list.")

    normalized = []

    for index, exercise in enumerate(exercises):
        if not isinstance(exercise, dict):
            raise ValueError(
                "Every exercise must be a valid object."
            )

        name = exercise.get("name")

        if not isinstance(name, str) or not name.strip():
            raise ValueError(
                "Every exercise must have a name."
            )

        sets = exercise.get("sets")
        reps = exercise.get("reps")

        if sets is None or reps is None:
            raise ValueError(
                "Every exercise must have sets and reps."
            )

        try:
            sets = int(sets)
            reps = int(reps)
        except (TypeError, ValueError):
            raise ValueError(
                "Exercise sets and reps must be integers."
            )

        if sets < 1:
            raise ValueError(
                "Exercise sets must be at least 1."
            )

        if reps < 1:
            raise ValueError(
                "Exercise reps must be at least 1."
            )

        weight = exercise.get("weight")

        if weight is not None:
            weight = str(weight).strip()

            if weight == "":
                weight = None

        normalized.append(
            {
                "name": name.strip(),
                "sets": sets,
                "reps": reps,
                "weight": weight,
                "order": index,
            }
        )

    if not normalized:
        raise ValueError(
            "A workout must contain at least one exercise."
        )

    return normalized


def build_template_exercises(template):
    """
    Create a completely independent exercise snapshot from a template.
    """

    exercises = []

    for exercise in template.get("exercises", []):
        exercises.append(
            {
                "name": exercise.get("name"),
                "sets": exercise.get("sets"),
                "reps": exercise.get("reps"),
                "weight": exercise.get("weight"),
            }
        )

    return normalize_exercises(exercises)


# ---------------------------------------------------------------------------
# Split days
# ---------------------------------------------------------------------------

SPLIT_DAY_COUNT = 6
SPLIT_DAY_NUMBERS = [1, 2, 3, 4, 5, 6]

SPLIT_NOT_CONFIGURED_MESSAGE = (
    "Split days are not configured for this workout template."
)


def normalize_split_days(split_days):
    """
    Validate and normalize an explicit six-day split configuration.

    Returns None when no split configuration was provided.
    Raises ValueError for anything malformed.
    """

    if split_days is None:
        return None

    if not isinstance(split_days, list):
        raise ValueError(
            "Split days must be provided as a list."
        )

    if len(split_days) != SPLIT_DAY_COUNT:
        raise ValueError(
            "A split must contain exactly six days."
        )

    normalized = []
    seen_days = set()

    for item in split_days:
        if not isinstance(item, dict):
            raise ValueError(
                "Every split day must be a valid object."
            )

        day = item.get("day")

        if isinstance(day, bool) or not isinstance(day, int):
            raise ValueError(
                "Split day numbers must be integers between 1 and 6."
            )

        if day < 1 or day > 6:
            raise ValueError(
                "Split day numbers must be integers between 1 and 6."
            )

        if day in seen_days:
            raise ValueError(
                "Split day numbers must be unique."
            )

        seen_days.add(day)

        label = item.get("label")

        if not isinstance(label, str) or not label.strip():
            raise ValueError(
                "Every split day needs a label."
            )

        normalized.append(
            {
                "day": day,
                "label": label.strip(),
                "exercises": normalize_exercises(
                    item.get("exercises", [])
                ),
            }
        )

    if sorted(seen_days) != SPLIT_DAY_NUMBERS:
        raise ValueError(
            "Split days must be exactly 1, 2, 3, 4, 5 and 6 "
            "with no duplicates."
        )

    normalized.sort(key=lambda entry: entry["day"])

    return normalized


def get_valid_split_days(template):
    """
    Return the template's normalized split configuration, or None.

    Missing, incomplete or malformed configurations all return None.
    """

    if not isinstance(template, dict):
        return None

    split_days = template.get("split_days")

    if not isinstance(split_days, list):
        return None

    try:
        return normalize_split_days(split_days)
    except ValueError:
        return None


def get_split_day_definition(split_days, day):
    for definition in split_days:
        if definition["day"] == day:
            return definition

    return None


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

def get_member(member_id):
    collection = get_members_collection()

    return collection.find_one(
        {
            "member_id": member_id,
        }
    )


def member_exists(member_id):
    return get_member(member_id) is not None


# ---------------------------------------------------------------------------
# Workout Templates
# ---------------------------------------------------------------------------

def get_template(template_id):
    collection = get_workout_templates_collection()

    object_id = normalize_template_id(template_id)

    if object_id is None:
        return None

    return collection.find_one(
        {
            "_id": object_id,
        }
    )


def get_template_by_key(template_key):
    collection = get_workout_templates_collection()

    if not isinstance(template_key, str):
        return None

    return collection.find_one(
        {
            "template_key": template_key.strip().lower(),
        }
    )


def get_all_templates():
    collection = get_workout_templates_collection()

    return list(
        collection.find().sort(
            [
                ("name", 1),
            ]
        )
    )


def create_template(data):
    collection = get_workout_templates_collection()

    template_key = data["template_key"].strip().lower()

    if get_template_by_key(template_key):
        raise ValueError(
            "Workout template already exists."
        )

    name = data.get("name")

    if not isinstance(name, str) or not name.strip():
        raise ValueError(
            "Workout template name is required."
        )

    exercises = normalize_exercises(
        data.get("exercises", [])
    )

    split_days = normalize_split_days(
        data.get("split_days")
    )

    now = utc_now()

    document = {
        "template_key": template_key,
        "name": name.strip(),
        "description": data.get(
            "description",
            "",
        ),
        "exercises": exercises,
        "created_at": now,
        "updated_at": now,
    }

    if split_days is not None:
        document["split_days"] = split_days

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return document


def update_template(template_id, data):
    collection = get_workout_templates_collection()

    object_id = normalize_template_id(template_id)

    if object_id is None:
        return None

    existing = collection.find_one(
        {
            "_id": object_id,
        }
    )

    if existing is None:
        return None

    update_data = {
        "updated_at": utc_now(),
    }

    if "template_key" in data:
        new_key = data["template_key"].strip().lower()

        conflicting = collection.find_one(
            {
                "template_key": new_key,
                "_id": {
                    "$ne": object_id,
                },
            }
        )

        if conflicting:
            raise ValueError(
                "Workout template already exists."
            )

        update_data["template_key"] = new_key

    if "name" in data:
        name = data["name"]

        if not isinstance(name, str) or not name.strip():
            raise ValueError(
                "Workout template name is required."
            )

        update_data["name"] = name.strip()

    if "description" in data:
        update_data["description"] = data["description"]

    if "exercises" in data:
        update_data["exercises"] = normalize_exercises(
            data["exercises"]
        )

    if "split_days" in data:
        update_data["split_days"] = normalize_split_days(
            data["split_days"]
        )

    collection.update_one(
        {
            "_id": object_id,
        },
        {
            "$set": update_data,
        },
    )

    return collection.find_one(
        {
            "_id": object_id,
        }
    )


def delete_template(template_id):
    """
    A template cannot be deleted while assigned to a member.

    Historical daily workouts remain untouched.
    """

    templates = get_workout_templates_collection()
    assignments = get_workout_assignments_collection()

    object_id = normalize_template_id(template_id)

    if object_id is None:
        return False

    template = templates.find_one(
        {
            "_id": object_id,
        }
    )

    if template is None:
        return False

    assignment_exists = assignments.find_one(
        {
            "template_id": object_id,
        }
    )

    if assignment_exists:
        raise ValueError(
            "This workout template is currently assigned to a member "
            "and cannot be deleted."
        )

    result = templates.delete_one(
        {
            "_id": object_id,
        }
    )

    return result.deleted_count > 0


# ---------------------------------------------------------------------------
# Template Assignments
# ---------------------------------------------------------------------------

def get_assignment_by_member(member_id):
    collection = get_workout_assignments_collection()

    return collection.find_one(
        {
            "member_id": member_id,
        }
    )


def assign_template(member_id, template_id):
    """
    Set or replace the member's current default workout template.

    Existing daily workouts are never modified.
    """

    member = get_member(member_id)

    if member is None:
        raise ValueError("Member not found.")

    template = get_template(template_id)

    if template is None:
        raise ValueError("Workout template not found.")

    collection = get_workout_assignments_collection()

    now = utc_now()

    existing = collection.find_one(
        {
            "member_id": member_id,
        }
    )

    if existing:
        collection.update_one(
            {
                "_id": existing["_id"],
            },
            {
                "$set": {
                    "template_id": template["_id"],
                    "template_key": template["template_key"],
                    "template_name": template["name"],
                    "updated_at": now,
                }
            },
        )

        return collection.find_one(
            {
                "_id": existing["_id"],
            }
        )

    document = {
        "member_id": member_id,
        "template_id": template["_id"],
        "template_key": template["template_key"],
        "template_name": template["name"],
        "created_at": now,
        "updated_at": now,
    }

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return document


# ---------------------------------------------------------------------------
# Daily Workouts
# ---------------------------------------------------------------------------

def get_daily_workout(member_id, workout_date):
    collection = get_daily_workouts_collection()

    normalized_date = normalize_workout_date(
        workout_date
    )

    return collection.find_one(
        {
            "member_id": member_id,
            "workout_date": normalized_date,
        }
    )


def create_daily_workout(
    member_id,
    workout_date,
    exercises,
    template_id=None,
    template_key=None,
    split_day=None,
    split_day_label=None,
    status=None,
):
    """
    Create an independent daily workout snapshot.

    Once stored, the daily workout does not depend on the template.
    """

    member = get_member(member_id)

    if member is None:
        raise ValueError("Member not found.")

    collection = get_daily_workouts_collection()

    normalized_date = normalize_workout_date(
        workout_date
    )

    existing = collection.find_one(
        {
            "member_id": member_id,
            "workout_date": normalized_date,
        }
    )

    if existing:
        raise ValueError(
            "Daily workout already exists for this member on this date."
        )

    normalized_exercises = normalize_exercises(
        exercises
    )

    normalized_template_id = None

    if template_id is not None:
        normalized_template_id = normalize_template_id(
            template_id
        )

        if normalized_template_id is None:
            raise ValueError(
                "Invalid workout template ID."
            )

    now = utc_now()

    document = {
        "member_id": member_id,
        "workout_date": normalized_date,
        "template_id": normalized_template_id,
        "template_key": template_key,
        "exercises": normalized_exercises,
        "created_at": now,
        "updated_at": now,
    }

    if split_day is not None:
        document["split_day"] = split_day

    if split_day_label is not None:
        document["split_day_label"] = split_day_label

    if status is not None:
        document["status"] = status
        document["completed_at"] = None
        document["completed_by_role"] = None

    try:
        result = collection.insert_one(document)
    except DuplicateKeyError as exc:
        # A concurrent request inserted the same member/date first.
        raise ValueError(
            "Daily workout already exists for this member on this date."
        ) from exc

    document["_id"] = result.inserted_id

    return document


def get_pending_split_workout(member_id, template_key):
    """
    Return the member's pending split workout for this template.

    Completed, legacy and non-split records never match.
    """

    collection = get_daily_workouts_collection()

    return collection.find_one(
        {
            "member_id": member_id,
            "template_key": template_key,
            "status": "pending",
            "split_day": {
                "$type": "int",
                "$gte": 1,
                "$lte": SPLIT_DAY_COUNT,
            },
        },
        sort=[
            ("created_at", 1),
        ],
    )


def count_completed_split_workouts(member_id, template_key):
    """
    Count only authoritative completed split workouts for this
    member and template.

    Legacy records (no status / no split_day) never count.
    """

    collection = get_daily_workouts_collection()

    return collection.count_documents(
        {
            "member_id": member_id,
            "template_key": template_key,
            "status": "completed",
            "split_day": {
                "$type": "int",
                "$gte": 1,
                "$lte": SPLIT_DAY_COUNT,
            },
        }
    )


def get_next_split_day(member_id, template_key):
    """
    Derive the next split day from completed history.

    No counter is stored and nothing is supplied by the client.
    """

    completed_count = count_completed_split_workouts(
        member_id,
        template_key,
    )

    return (completed_count % SPLIT_DAY_COUNT) + 1


def get_latest_completed_split_workout(
    member_id,
    template_key,
    split_day,
):
    """
    Return the member's most recent completed workout for one
    template and split day.
    """

    collection = get_daily_workouts_collection()

    return collection.find_one(
        {
            "member_id": member_id,
            "template_key": template_key,
            "split_day": split_day,
            "status": "completed",
        },
        sort=[
            ("completed_at", -1),
        ],
    )


def generate_split_daily_workout(
    member_id,
    workout_date,
    template,
):
    """
    Generate (or return) the member's pending split workout.

    Exercises come from the member's most recent completed workout
    for the computed split day, otherwise from the template's
    configured split day.
    """

    member = get_member(member_id)

    if member is None:
        raise ValueError("Member not found.")

    split_days = get_valid_split_days(template)

    if split_days is None:
        raise ValueError(
            SPLIT_NOT_CONFIGURED_MESSAGE
        )

    template_key = template.get("template_key")

    pending = get_pending_split_workout(
        member_id,
        template_key,
    )

    if pending is not None:
        return pending

    next_day = get_next_split_day(
        member_id,
        template_key,
    )

    day_definition = get_split_day_definition(
        split_days,
        next_day,
    )

    if day_definition is None:
        raise ValueError(
            SPLIT_NOT_CONFIGURED_MESSAGE
        )

    previous = get_latest_completed_split_workout(
        member_id,
        template_key,
        next_day,
    )

    if previous is not None:
        source_exercises = previous.get(
            "exercises",
            [],
        )
    else:
        source_exercises = day_definition.get(
            "exercises",
            [],
        )

    try:
        return create_daily_workout(
            member_id=member_id,
            workout_date=workout_date,
            exercises=source_exercises,
            template_id=template["_id"],
            template_key=template_key,
            split_day=next_day,
            split_day_label=day_definition["label"],
            status="pending",
        )
    except ValueError:
        # Another request won the insert race. Return the stored
        # workout instead of failing or creating a duplicate.
        concurrent = get_daily_workout(
            member_id,
            workout_date,
        )

        if concurrent is not None:
            return concurrent

        raise


def complete_daily_workout(
    member_id,
    workout_id,
    completed_by_role,
):
    """
    Atomically move one pending split workout to completed.

    Returns (outcome, document):
    - "completed": the transition happened
    - "already_completed": it was already completed
    - "missing": not found, or owned by another member
    - "legacy": found, but not a split workout
    """

    collection = get_daily_workouts_collection()

    object_id = normalize_object_id(workout_id)

    if object_id is None:
        return "missing", None

    now = utc_now()

    document = collection.find_one_and_update(
        {
            "_id": object_id,
            "member_id": member_id,
            "status": "pending",
            "split_day": {
                "$type": "int",
                "$gte": 1,
                "$lte": SPLIT_DAY_COUNT,
            },
        },
        {
            "$set": {
                "status": "completed",
                "completed_at": now,
                "completed_by_role": completed_by_role,
                "updated_at": now,
            }
        },
        return_document=ReturnDocument.AFTER,
    )

    if document is not None:
        return "completed", document

    existing = collection.find_one(
        {
            "_id": object_id,
        }
    )

    if existing is None:
        return "missing", None

    if existing.get("member_id") != member_id:
        return "missing", None

    split_day = existing.get("split_day")

    if isinstance(split_day, bool) or not isinstance(
        split_day,
        int,
    ):
        return "legacy", existing

    if split_day < 1 or split_day > SPLIT_DAY_COUNT:
        return "legacy", existing

    if existing.get("status") == "completed":
        return "already_completed", existing

    return "legacy", existing


def create_daily_workout_from_assignment(
    member_id,
    workout_date,
    split_requested=False,
):
    """
    Generate a daily workout from the member's CURRENT assignment.

    Split templates produce a split-day snapshot. Legacy templates
    keep the existing flat behaviour unless split mode is
    explicitly requested.
    """

    member = get_member(member_id)

    if member is None:
        raise ValueError("Member not found.")

    assignment = get_assignment_by_member(
        member_id
    )

    if assignment is None:
        raise ValueError(
            "No workout template assigned to this member."
        )

    template_id = assignment.get("template_id")

    if template_id is None:
        raise ValueError(
            "The member's workout assignment is invalid."
        )

    template = get_template(
        template_id
    )

    if template is None:
        raise ValueError(
            "The assigned workout template no longer exists."
        )

    split_days = get_valid_split_days(template)

    if split_requested and split_days is None:
        raise ValueError(
            SPLIT_NOT_CONFIGURED_MESSAGE
        )

    if split_days is not None:
        return generate_split_daily_workout(
            member_id,
            workout_date,
            template,
        )

    exercises = build_template_exercises(
        template
    )

    try:
        return create_daily_workout(
            member_id=member_id,
            workout_date=workout_date,
            exercises=exercises,
            template_id=template["_id"],
            template_key=template["template_key"],
        )
    except ValueError:
        concurrent = get_daily_workout(
            member_id,
            workout_date,
        )

        if concurrent is not None:
            return concurrent

        raise


def sync_member_daily_workout_with_assignment(
    member_id,
    workout_date=None,
    split_requested=False,
):
    """
    Return the requested day's existing workout if one exists.

    Otherwise create a new snapshot from the member's
    current default assignment.
    """

    if workout_date is None:
        workout_date = date.today()

    existing = get_daily_workout(
        member_id,
        workout_date,
    )

    if existing is not None:
        return existing

    return create_daily_workout_from_assignment(
        member_id,
        workout_date,
        split_requested=split_requested,
    )


def update_daily_workout(
    member_id,
    workout_date,
    exercises,
):
    """
    Replace exercises for one specific daily workout.

    This never changes the template or any other historical workout.
    """

    collection = get_daily_workouts_collection()

    normalized_date = normalize_workout_date(
        workout_date
    )

    normalized_exercises = normalize_exercises(
        exercises
    )

    result = collection.update_one(
        {
            "member_id": member_id,
            "workout_date": normalized_date,
        },
        {
            "$set": {
                "exercises": normalized_exercises,
                "updated_at": utc_now(),
            }
        },
    )

    if result.matched_count == 0:
        return None

    return collection.find_one(
        {
            "member_id": member_id,
            "workout_date": normalized_date,
        }
    )


def delete_daily_workout(
    member_id,
    workout_date,
):
    """
    Delete one daily workout.

    This does not affect:
    - the workout template
    - the member's assignment
    - any other historical workout
    """

    collection = get_daily_workouts_collection()

    normalized_date = normalize_workout_date(
        workout_date
    )

    workout = collection.find_one(
        {
            "member_id": member_id,
            "workout_date": normalized_date,
        }
    )

    if workout is None:
        return False

    split_day = workout.get("split_day")

    if (
        workout.get("status") == "completed"
        and isinstance(split_day, int)
        and not isinstance(split_day, bool)
        and 1 <= split_day <= SPLIT_DAY_COUNT
    ):
        raise ValueError(
            "Completed workouts cannot be deleted because they "
            "preserve rotation history."
        )

    result = collection.delete_one(
        {
            "_id": workout["_id"],
            "member_id": member_id,
        }
    )

    return result.deleted_count > 0


def get_member_workout_history(member_id):
    collection = get_daily_workouts_collection()

    return list(
        collection.find(
            {
                "member_id": member_id,
            }
        ).sort(
            [
                ("workout_date", -1),
            ]
        )
    )