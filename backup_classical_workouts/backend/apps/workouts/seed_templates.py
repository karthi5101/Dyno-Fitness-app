from apps.workouts.repositories import (
    create_template,
    get_template_by_key,
)


TEMPLATES = [
    {
        "template_key": "strength",
        "name": "Strength",
        "description": (
            "General strength-focused workout template."
        ),
        "exercises": [
            {
                "name": "Barbell Squat",
                "sets": 3,
                "reps": 8,
                "weight": None,
                "order": 0,
            },
            {
                "name": "Bench Press",
                "sets": 3,
                "reps": 8,
                "weight": None,
                "order": 1,
            },
            {
                "name": "Lat Pulldown",
                "sets": 3,
                "reps": 10,
                "weight": None,
                "order": 2,
            },
            {
                "name": "Shoulder Press",
                "sets": 3,
                "reps": 10,
                "weight": None,
                "order": 3,
            },
        ],
    },
    {
        "template_key": "weight_loss",
        "name": "Weight Loss",
        "description": (
            "General conditioning and weight-loss-focused "
            "workout template."
        ),
        "exercises": [
            {
                "name": "Treadmill",
                "sets": 1,
                "reps": 15,
                "weight": None,
                "order": 0,
            },
            {
                "name": "Bodyweight Squat",
                "sets": 3,
                "reps": 15,
                "weight": None,
                "order": 1,
            },
            {
                "name": "Walking Lunges",
                "sets": 3,
                "reps": 12,
                "weight": None,
                "order": 2,
            },
            {
                "name": "Mountain Climbers",
                "sets": 3,
                "reps": 20,
                "weight": None,
                "order": 3,
            },
        ],
    },
    {
        "template_key": "weight_gain",
        "name": "Weight Gain",
        "description": (
            "General muscle-building and weight-gain-focused "
            "workout template."
        ),
        "exercises": [
            {
                "name": "Barbell Squat",
                "sets": 3,
                "reps": 10,
                "weight": None,
                "order": 0,
            },
            {
                "name": "Bench Press",
                "sets": 3,
                "reps": 10,
                "weight": None,
                "order": 1,
            },
            {
                "name": "Seated Row",
                "sets": 3,
                "reps": 10,
                "weight": None,
                "order": 2,
            },
            {
                "name": "Bicep Curl",
                "sets": 3,
                "reps": 12,
                "weight": None,
                "order": 3,
            },
        ],
    },
    {
        "template_key": "endurance",
        "name": "Endurance",
        "description": (
            "General cardiovascular and muscular-endurance "
            "workout template."
        ),
        "exercises": [
            {
                "name": "Cycling",
                "sets": 1,
                "reps": 20,
                "weight": None,
                "order": 0,
            },
            {
                "name": "Bodyweight Squat",
                "sets": 3,
                "reps": 15,
                "weight": None,
                "order": 1,
            },
            {
                "name": "Push Ups",
                "sets": 3,
                "reps": 12,
                "weight": None,
                "order": 2,
            },
            {
                "name": "Plank",
                "sets": 3,
                "reps": 30,
                "weight": None,
                "order": 3,
            },
        ],
    },
]


def seed_templates():
    created = 0
    skipped = 0

    for template_data in TEMPLATES:
        existing = get_template_by_key(
            template_data["template_key"]
        )

        if existing:
            skipped += 1
            continue

        create_template(template_data)
        created += 1

    print(
        f"Templates created: {created}"
    )
    print(
        f"Templates already existed: {skipped}"
    )


if __name__ == "__main__":
    seed_templates()

