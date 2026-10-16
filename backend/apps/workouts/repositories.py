from datetime import date, datetime, time, timezone

from bson import ObjectId

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

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return document


def create_daily_workout_from_assignment(
    member_id,
    workout_date,
):
    """
    Generate a daily workout from the member's CURRENT assignment.

    The template exercises are copied into the daily workout.
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

    exercises = build_template_exercises(
        template
    )

    return create_daily_workout(
        member_id=member_id,
        workout_date=workout_date,
        exercises=exercises,
        template_id=template["_id"],
        template_key=template["template_key"],
    )


def sync_member_daily_workout_with_assignment(
    member_id,
    workout_date=None,
):
    """
    Return today's existing workout if one exists.

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

    result = collection.delete_one(
        {
            "member_id": member_id,
            "workout_date": normalized_date,
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