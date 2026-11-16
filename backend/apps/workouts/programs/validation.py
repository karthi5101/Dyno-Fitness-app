"""Validation helpers shared by programs and member assignment copies."""

from ..library.utils import normalize_text


ALLOWED_TRACKING_TYPES = {"weight_reps", "reps", "time"}
ALLOWED_SET_TYPES = {"normal", "warmup"}

MAX_DAYS = 7
MAX_BLOCKS_PER_DAY = 12
MAX_SETS_PER_BLOCK = 10
MAX_REST_SECONDS = 600


def _as_int(value, field, *, minimum=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a whole number.")

    if minimum is not None and number < minimum:
        raise ValueError(f"{field} must be at least {minimum}.")

    return number


def normalize_days(days):
    """Validate and normalize a program day list.

    Raises ValueError with a human-readable message on any violation.
    """

    if days is None:
        return []

    if not isinstance(days, list):
        raise ValueError("Program days must be a list.")

    if len(days) > MAX_DAYS:
        raise ValueError(f"A program may have at most {MAX_DAYS} days.")

    normalized_days = []
    seen_day_keys = set()

    for day_index, raw_day in enumerate(days, start=1):
        if not isinstance(raw_day, dict):
            raise ValueError("Each program day must be an object.")

        day_key = normalize_text(raw_day.get("day_key")) or f"day_{day_index}"

        if day_key in seen_day_keys:
            raise ValueError(f"Duplicate day_key: {day_key}.")

        seen_day_keys.add(day_key)

        label = normalize_text(raw_day.get("label")) or day_key
        order = _as_int(
            raw_day.get("order", day_index),
            "Day order",
            minimum=0,
        )

        raw_blocks = raw_day.get("blocks") or []

        if not isinstance(raw_blocks, list):
            raise ValueError("Day blocks must be a list.")

        if len(raw_blocks) > MAX_BLOCKS_PER_DAY:
            raise ValueError(
                f"A day may have at most {MAX_BLOCKS_PER_DAY} blocks."
            )

        normalized_blocks = []
        seen_block_ids = set()

        for block_index, raw_block in enumerate(raw_blocks, start=1):
            if not isinstance(raw_block, dict):
                raise ValueError("Each block must be an object.")

            block_id = (
                normalize_text(raw_block.get("block_id"))
                or f"{day_key}_block_{block_index}"
            )

            if block_id in seen_block_ids:
                raise ValueError(f"Duplicate block_id: {block_id}.")

            seen_block_ids.add(block_id)

            exercise_id = normalize_text(raw_block.get("exercise_id"))

            if not exercise_id:
                raise ValueError(
                    f"Block {block_id} needs an exercise_id."
                )

            exercise_name = (
                normalize_text(raw_block.get("exercise_name"))
                or exercise_id
            )
            tracking_type = normalize_text(
                raw_block.get("tracking_type")
            ) or "weight_reps"

            if tracking_type not in ALLOWED_TRACKING_TYPES:
                raise ValueError(
                    f"Unsupported tracking_type: {tracking_type}."
                )

            raw_sets = raw_block.get("sets") or []

            if not isinstance(raw_sets, list):
                raise ValueError("Block sets must be a list.")

            if len(raw_sets) > MAX_SETS_PER_BLOCK:
                raise ValueError(
                    f"A block may have at most {MAX_SETS_PER_BLOCK} sets."
                )

            normalized_sets = []

            for raw_set in raw_sets:
                if not isinstance(raw_set, dict):
                    raise ValueError("Each set must be an object.")

                set_type = (
                    normalize_text(raw_set.get("set_type")) or "normal"
                )

                if set_type not in ALLOWED_SET_TYPES:
                    raise ValueError(
                        f"Unsupported set_type: {set_type}."
                    )

                reps_min = _as_int(
                    raw_set.get("reps_min", 0),
                    "reps_min",
                    minimum=0,
                )
                reps_max = _as_int(
                    raw_set.get("reps_max", 0),
                    "reps_max",
                    minimum=0,
                )

                if reps_min > reps_max:
                    raise ValueError(
                        "reps_min cannot be greater than reps_max."
                    )

                rest_s = _as_int(
                    raw_set.get("rest_s", 0),
                    "rest_s",
                    minimum=0,
                )

                if rest_s > MAX_REST_SECONDS:
                    raise ValueError(
                        f"rest_s cannot exceed {MAX_REST_SECONDS} seconds."
                    )

                normalized_set = {
                    "set_type": set_type,
                    "reps_min": reps_min,
                    "reps_max": reps_max,
                    "rest_s": rest_s,
                }

                if raw_set.get("duration_s") is not None:
                    normalized_set["duration_s"] = _as_int(
                        raw_set.get("duration_s"),
                        "duration_s",
                        minimum=0,
                    )

                normalized_sets.append(normalized_set)

            normalized_blocks.append(
                {
                    "block_id": block_id,
                    "exercise_id": exercise_id,
                    "exercise_name": exercise_name,
                    "tracking_type": tracking_type,
                    "notes": normalize_text(raw_block.get("notes")),
                    "sets": normalized_sets,
                }
            )

        normalized_days.append(
            {
                "day_key": day_key,
                "label": label,
                "order": order,
                "blocks": normalized_blocks,
            }
        )

    return normalized_days


def normalize_program(data):
    if not isinstance(data, dict):
        raise ValueError("Program payload must be an object.")

    name = normalize_text(data.get("name"))

    if not name:
        raise ValueError("Program name is required.")

    return {
        "name": name,
        "name_lc": name.lower(),
        "goal": normalize_text(data.get("goal")),
        "level": normalize_text(data.get("level")),
        "days": normalize_days(data.get("days")),
    }
