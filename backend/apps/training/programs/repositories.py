import base64
import copy
import json
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from core.database.mongodb import MongoDB

from .validation import normalize_days, normalize_program

PROGRAMS_COLLECTION = "trn_programs"


def _collection():
    return MongoDB.get_database()[PROGRAMS_COLLECTION]


def _object_id(value):
    try:
        return ObjectId(str(value))
    except Exception:
        return None


def _now():
    return datetime.now(timezone.utc)


def ensure_indexes():
    collection = _collection()
    collection.create_index(
        "name_lc",
        unique=True,
        name="unique_trn_program_name_lc",
    )
    collection.create_index(
        [("archived", 1), ("level", 1), ("goal", 1)],
        name="trn_program_filters",
    )


def serialize_program(program):
    if not program:
        return None

    return {
        "id": str(program.get("_id", "")),
        "name": program.get("name", ""),
        "goal": program.get("goal", ""),
        "level": program.get("level", ""),
        "days": program.get("days", []),
        "version": program.get("version", 1),
        "favorite_by": program.get("favorite_by", []),
        "archived": bool(program.get("archived", False)),
        "created_by": program.get("created_by"),
        "created_at": (
            program["created_at"].isoformat()
            if isinstance(program.get("created_at"), datetime)
            else program.get("created_at")
        ),
        "updated_at": (
            program["updated_at"].isoformat()
            if isinstance(program.get("updated_at"), datetime)
            else program.get("updated_at")
        ),
    }


def program_list(filters=None, limit=20, cursor=None):
    """List programs with optional filters and cursor pagination."""

    filters = filters if isinstance(filters, dict) else {}
    conditions = []

    if "archived" in filters and filters["archived"] is not None:
        conditions.append({"archived": bool(filters["archived"])})
    else:
        conditions.append({"archived": False})

    if filters.get("level"):
        conditions.append({"level": filters["level"]})

    if filters.get("goal"):
        conditions.append({"goal": filters["goal"]})

    if cursor:
        try:
            decoded = json.loads(
                base64.urlsafe_b64decode(
                    cursor + "=" * (-len(cursor) % 4)
                ).decode()
            )
            name_lc = decoded.get("name_lc")
            object_id = _object_id(decoded.get("id"))

            if name_lc and object_id:
                conditions.append(
                    {
                        "$or": [
                            {"name_lc": {"$gt": name_lc}},
                            {
                                "name_lc": name_lc,
                                "_id": {"$gt": object_id},
                            },
                        ]
                    }
                )
        except Exception:
            pass

    query = conditions[0] if len(conditions) == 1 else {"$and": conditions}
    programs = list(
        _collection()
        .find(query)
        .sort([("name_lc", 1), ("_id", 1)])
        .limit(limit + 1)
    )

    next_cursor = None

    if len(programs) > limit:
        programs = programs[:limit]
        last = programs[-1]
        next_cursor = base64.urlsafe_b64encode(
            json.dumps(
                {
                    "name_lc": last.get("name_lc", ""),
                    "id": str(last.get("_id")),
                },
                separators=(",", ":"),
            ).encode()
        ).decode()
        next_cursor = next_cursor.rstrip("=")

    return programs, next_cursor


def program_detail(program_id):
    object_id = _object_id(program_id)

    if object_id is None:
        return None

    return _collection().find_one({"_id": object_id})


def program_create(data, created_by):
    """Create a new program. Returns (program, is_new)."""

    payload = normalize_program(data)
    collection = _collection()

    if collection.find_one({"name_lc": payload["name_lc"]}):
        raise ValueError("A program with this name already exists.")

    now = _now()
    program = {
        **payload,
        "version": 1,
        "favorite_by": [],
        "archived": False,
        "created_by": created_by,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = collection.insert_one(program)
    except DuplicateKeyError as exc:
        raise ValueError(
            "A program with this name already exists."
        ) from exc

    program["_id"] = result.inserted_id

    return program, True


def program_update(program_id, data, updated_by):
    """Update a program. Returns the updated program or None."""

    object_id = _object_id(program_id)

    if object_id is None:
        return None

    collection = _collection()
    existing = collection.find_one({"_id": object_id})

    if existing is None:
        return None

    if not isinstance(data, dict):
        raise ValueError("Program payload must be an object.")

    merged = {**existing, **data}
    payload = normalize_program(merged)

    if (
        payload["name_lc"] != existing.get("name_lc")
        and collection.find_one(
            {
                "name_lc": payload["name_lc"],
                "_id": {"$ne": object_id},
            }
        )
    ):
        raise ValueError("A program with this name already exists.")

    update = {
        **payload,
        "version": int(existing.get("version", 0)) + 1,
        "updated_at": _now(),
    }

    if "archived" in data:
        update["archived"] = bool(data["archived"])

    if "favorite_by" in data and isinstance(
        data["favorite_by"], list
    ):
        update["favorite_by"] = data["favorite_by"]

    try:
        collection.update_one({"_id": object_id}, {"$set": update})
    except DuplicateKeyError as exc:
        raise ValueError(
            "A program with this name already exists."
        ) from exc

    return collection.find_one({"_id": object_id})


def program_duplicate(program_id, created_by):
    """Create an independent deep copy of a program."""

    source = program_detail(program_id)

    if source is None:
        return None

    collection = _collection()
    base_name = f"{source.get('name', 'Program')} (copy)"
    name = base_name
    suffix = 2

    while collection.find_one({"name_lc": name.lower()}):
        name = f"{base_name} {suffix}"
        suffix += 1

    now = _now()
    duplicate = {
        "name": name,
        "name_lc": name.lower(),
        "goal": source.get("goal", ""),
        "level": source.get("level", ""),
        "days": copy.deepcopy(source.get("days", [])),
        "version": 1,
        "favorite_by": [],
        "archived": False,
        "created_by": created_by,
        "created_at": now,
        "updated_at": now,
    }

    result = collection.insert_one(duplicate)
    duplicate["_id"] = result.inserted_id

    return duplicate


def program_archive(program_id):
    """Archive a program. Returns True when the program exists."""

    object_id = _object_id(program_id)

    if object_id is None:
        return False

    result = _collection().update_one(
        {"_id": object_id},
        {"$set": {"archived": True, "updated_at": _now()}},
    )

    return result.matched_count > 0


# ---------------------------------------------------------------------------
# Starter programs
# ---------------------------------------------------------------------------

def _block(block_id, slug, name, sets, notes="", tracking="weight_reps"):
    return {
        "block_id": block_id,
        "exercise_id": slug,
        "exercise_name": name,
        "tracking_type": tracking,
        "notes": notes,
        "sets": sets,
    }


def _sets(reps_min, reps_max, rest_s, count=3):
    return [
        {
            "set_type": "normal",
            "reps_min": reps_min,
            "reps_max": reps_max,
            "rest_s": rest_s,
        }
        for _ in range(count)
    ]


def starter_programs():
    return {
        "PPL 3-day": {
            "goal": "muscle growth",
            "level": "intermediate",
            "days": [
                {
                    "day_key": "A",
                    "label": "Push Day",
                    "order": 1,
                    "blocks": [
                        _block(
                            "bench",
                            "barbell-bench-press-medium-grip",
                            "Barbell Bench Press",
                            _sets(3, 6, 120),
                        ),
                        _block(
                            "ohp",
                            "dumbbell-shoulder-press",
                            "Dumbbell Shoulder Press",
                            _sets(3, 8, 90),
                        ),
                        _block(
                            "dip",
                            "dips-triceps-version",
                            "Dips",
                            _sets(3, 8, 90),
                            tracking="reps",
                        ),
                    ],
                },
                {
                    "day_key": "B",
                    "label": "Pull Day",
                    "order": 2,
                    "blocks": [
                        _block(
                            "pullup",
                            "band-assisted-pull-up",
                            "Band Assisted Pull-Up",
                            _sets(3, 8, 120),
                            tracking="reps",
                        ),
                        _block(
                            "row",
                            "bent-over-barbell-row",
                            "Bent Over Barbell Row",
                            _sets(3, 6, 120),
                        ),
                        _block(
                            "curl",
                            "barbell-curl",
                            "Barbell Curl",
                            _sets(3, 8, 90),
                        ),
                    ],
                },
                {
                    "day_key": "C",
                    "label": "Legs Day",
                    "order": 3,
                    "blocks": [
                        _block(
                            "squat",
                            "barbell-squat",
                            "Barbell Squat",
                            _sets(3, 6, 180),
                        ),
                        _block(
                            "legpress",
                            "leg-press",
                            "Leg Press",
                            _sets(3, 8, 120),
                        ),
                        _block(
                            "legcurl",
                            "lying-leg-curls",
                            "Lying Leg Curls",
                            _sets(3, 8, 90),
                        ),
                    ],
                },
            ],
        },
        "Upper/Lower 4-day": {
            "goal": "balanced development",
            "level": "intermediate",
            "days": [
                {
                    "day_key": "A",
                    "label": "Upper Body Push",
                    "order": 1,
                    "blocks": [
                        _block(
                            "bench",
                            "barbell-bench-press-medium-grip",
                            "Barbell Bench Press",
                            _sets(4, 6, 120),
                        ),
                        _block(
                            "ohp",
                            "dumbbell-shoulder-press",
                            "Dumbbell Shoulder Press",
                            _sets(4, 8, 90),
                        ),
                        _block(
                            "dip",
                            "dips-triceps-version",
                            "Dips",
                            _sets(3, 10, 90),
                            tracking="reps",
                        ),
                    ],
                },
                {
                    "day_key": "B",
                    "label": "Upper Body Pull",
                    "order": 2,
                    "blocks": [
                        _block(
                            "pullup",
                            "band-assisted-pull-up",
                            "Band Assisted Pull-Up",
                            _sets(3, 10, 120),
                            tracking="reps",
                        ),
                        _block(
                            "row",
                            "bent-over-barbell-row",
                            "Bent Over Barbell Row",
                            _sets(4, 6, 120),
                        ),
                        _block(
                            "curl",
                            "barbell-curl",
                            "Barbell Curl",
                            _sets(3, 10, 90),
                        ),
                    ],
                },
                {
                    "day_key": "C",
                    "label": "Lower Body Squat",
                    "order": 3,
                    "blocks": [
                        _block(
                            "squat",
                            "barbell-squat",
                            "Barbell Squat",
                            _sets(3, 8, 180),
                        ),
                        _block(
                            "legpress",
                            "leg-press",
                            "Leg Press",
                            _sets(3, 10, 120),
                        ),
                        _block(
                            "legcurl",
                            "lying-leg-curls",
                            "Lying Leg Curls",
                            _sets(3, 10, 90),
                        ),
                    ],
                },
                {
                    "day_key": "D",
                    "label": "Lower Body Hinge",
                    "order": 4,
                    "blocks": [
                        _block(
                            "deadlift",
                            "barbell-deadlift",
                            "Barbell Deadlift",
                            _sets(1, 5, 240),
                        ),
                        _block(
                            "romanian",
                            "romanian-deadlift",
                            "Romanian Deadlift",
                            _sets(3, 8, 180),
                        ),
                        _block(
                            "curl",
                            "barbell-curl",
                            "Barbell Curl",
                            _sets(3, 10, 90),
                        ),
                    ],
                },
            ],
        },
        "Full Body 3-day": {
            "goal": "general fitness",
            "level": "beginner",
            "days": [
                {
                    "day_key": "A",
                    "label": "Full Body A",
                    "order": 1,
                    "blocks": [
                        _block(
                            "squat",
                            "barbell-squat",
                            "Barbell Squat",
                            _sets(3, 8, 150),
                        ),
                        _block(
                            "pushup",
                            "push-up-wide",
                            "Push-Up",
                            _sets(3, 12, 90),
                            tracking="reps",
                        ),
                        _block(
                            "row",
                            "bent-over-barbell-row",
                            "Bent Over Barbell Row",
                            _sets(3, 8, 120),
                        ),
                    ],
                },
                {
                    "day_key": "B",
                    "label": "Full Body B",
                    "order": 2,
                    "blocks": [
                        _block(
                            "bench",
                            "barbell-bench-press-medium-grip",
                            "Barbell Bench Press",
                            _sets(3, 8, 150),
                        ),
                        _block(
                            "dip",
                            "dips-triceps-version",
                            "Dips",
                            _sets(3, 12, 90),
                            tracking="reps",
                        ),
                        _block(
                            "curl",
                            "barbell-curl",
                            "Barbell Curl",
                            _sets(3, 8, 90),
                        ),
                    ],
                },
                {
                    "day_key": "C",
                    "label": "Full Body C",
                    "order": 3,
                    "blocks": [
                        _block(
                            "squat",
                            "barbell-squat",
                            "Barbell Squat",
                            _sets(3, 8, 150),
                        ),
                        _block(
                            "ohp",
                            "dumbbell-shoulder-press",
                            "Dumbbell Shoulder Press",
                            _sets(3, 8, 120),
                        ),
                        _block(
                            "curl",
                            "barbell-curl",
                            "Barbell Curl",
                            _sets(3, 8, 90),
                        ),
                    ],
                },
            ],
        },
        "5x5 3-day": {
            "goal": "strength gain",
            "level": "intermediate",
            "days": [
                {
                    "day_key": "A",
                    "label": "Squat Day",
                    "order": 1,
                    "blocks": [
                        _block(
                            "squat",
                            "barbell-squat",
                            "Barbell Squat",
                            _sets(5, 5, 180),
                            notes="5x5 protocol",
                        ),
                        _block(
                            "bench",
                            "barbell-bench-press-medium-grip",
                            "Barbell Bench Press",
                            _sets(5, 5, 180),
                            notes="5x5 protocol",
                        ),
                        _block(
                            "row",
                            "bent-over-barbell-row",
                            "Bent Over Barbell Row",
                            _sets(5, 5, 180),
                            notes="5x5 protocol",
                        ),
                    ],
                },
                {
                    "day_key": "B",
                    "label": "Bench Day",
                    "order": 2,
                    "blocks": [
                        _block(
                            "bench",
                            "barbell-bench-press-medium-grip",
                            "Barbell Bench Press",
                            _sets(5, 5, 180),
                            notes="5x5 protocol",
                        ),
                        _block(
                            "squat",
                            "barbell-squat",
                            "Barbell Squat",
                            _sets(5, 5, 180),
                            notes="5x5 protocol",
                        ),
                        _block(
                            "press",
                            "barbell-shoulder-press",
                            "Barbell Shoulder Press",
                            _sets(5, 5, 180),
                            notes="5x5 protocol",
                        ),
                    ],
                },
                {
                    "day_key": "C",
                    "label": "Deadlift Day",
                    "order": 3,
                    "blocks": [
                        _block(
                            "deadlift",
                            "barbell-deadlift",
                            "Barbell Deadlift",
                            _sets(1, 5, 240),
                            notes="5x5 protocol",
                        ),
                        _block(
                            "bench",
                            "barbell-bench-press-medium-grip",
                            "Barbell Bench Press",
                            _sets(5, 5, 180),
                            notes="5x5 protocol",
                        ),
                        _block(
                            "row",
                            "bent-over-barbell-row",
                            "Bent Over Barbell Row",
                            _sets(5, 5, 180),
                            notes="5x5 protocol",
                        ),
                    ],
                },
            ],
        },
    }


def program_seed_starter_programs():
    """Seed the four original starter programs by exercise slug.

    Returns the number of programs processed. Fails loudly when a slug is
    missing from the exercise seed data.
    """

    seed_path = (
        Path(__file__).resolve().parents[1]
        / "seed"
        / "exercises.json"
    )

    if not seed_path.is_file():
        raise ValueError(f"Exercise seed file not found: {seed_path}")

    from ..library.utils import slugify_exercise_id

    data = json.loads(seed_path.read_text(encoding="utf-8"))
    available_slugs = {
        slugify_exercise_id(item.get("id"))
        for item in data
        if isinstance(item, dict)
    }

    programs = starter_programs()
    missing = sorted(
        {
            block["exercise_id"]
            for program in programs.values()
            for day in program["days"]
            for block in day["blocks"]
            if block["exercise_id"] not in available_slugs
        }
    )

    if missing:
        raise ValueError(
            "Starter program seed references missing exercise slugs: "
            + ", ".join(missing)
        )

    collection = _collection()
    now = _now()
    count = 0

    for name, definition in programs.items():
        name_lc = name.lower()
        days = normalize_days(definition["days"])
        existing = collection.find_one({"name_lc": name_lc})

        if existing:
            collection.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "goal": definition["goal"],
                        "level": definition["level"],
                        "days": days,
                        "updated_at": now,
                    }
                },
            )
        else:
            collection.insert_one(
                {
                    "name": name,
                    "name_lc": name_lc,
                    "goal": definition["goal"],
                    "level": definition["level"],
                    "days": days,
                    "version": 1,
                    "favorite_by": [],
                    "archived": False,
                    "created_by": "system",
                    "created_at": now,
                    "updated_at": now,
                }
            )

        count += 1

    return count
