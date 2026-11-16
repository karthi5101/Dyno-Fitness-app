from django.core.management.base import BaseCommand

from apps.workouts.repositories import (
    create_template,
    get_template_by_key,
)


TEMPLATES = [
    {
        "template_key": "strength",
        "name": "Strength",
        "description": "Progressive strength-focused workout.",
        "exercises": [
            {
                "name": "Barbell Squat",
                "sets": 4,
                "reps": 8,
                "weight": None,
            },
            {
                "name": "Bench Press",
                "sets": 4,
                "reps": 8,
                "weight": None,
            },
            {
                "name": "Lat Pulldown",
                "sets": 3,
                "reps": 10,
                "weight": None,
            },
            {
                "name": "Seated Cable Row",
                "sets": 3,
                "reps": 10,
                "weight": None,
            },
            {
                "name": "Dumbbell Shoulder Press",
                "sets": 3,
                "reps": 10,
                "weight": None,
            },
        ],
    },
    {
        "template_key": "weight_loss",
        "name": "Weight Loss",
        "description": "Higher-volume workout focused on calorie expenditure.",
        "exercises": [
            {
                "name": "Bodyweight Squat",
                "sets": 3,
                "reps": 15,
                "weight": None,
            },
            {
                "name": "Walking Lunges",
                "sets": 3,
                "reps": 12,
                "weight": None,
            },
            {
                "name": "Push Ups",
                "sets": 3,
                "reps": 12,
                "weight": None,
            },
            {
                "name": "Lat Pulldown",
                "sets": 3,
                "reps": 12,
                "weight": None,
            },
            {
                "name": "Mountain Climbers",
                "sets": 3,
                "reps": 20,
                "weight": None,
            },
        ],
    },
    {
        "template_key": "weight_gain",
        "name": "Weight Gain",
        "description": "Hypertrophy-focused workout for muscle and weight gain.",
        "exercises": [
            {
                "name": "Barbell Squat",
                "sets": 4,
                "reps": 10,
                "weight": None,
            },
            {
                "name": "Romanian Deadlift",
                "sets": 3,
                "reps": 10,
                "weight": None,
            },
            {
                "name": "Incline Dumbbell Press",
                "sets": 4,
                "reps": 10,
                "weight": None,
            },
            {
                "name": "Lat Pulldown",
                "sets": 4,
                "reps": 10,
                "weight": None,
            },
            {
                "name": "Dumbbell Curl",
                "sets": 3,
                "reps": 12,
                "weight": None,
            },
        ],
    },
    {
        "template_key": "endurance",
        "name": "Endurance",
        "description": "Conditioning-focused workout for endurance development.",
        "exercises": [
            {
                "name": "Treadmill Walk",
                "sets": 1,
                "reps": 20,
                "weight": None,
            },
            {
                "name": "Stationary Bike",
                "sets": 1,
                "reps": 15,
                "weight": None,
            },
            {
                "name": "Bodyweight Squat",
                "sets": 3,
                "reps": 15,
                "weight": None,
            },
            {
                "name": "Push Ups",
                "sets": 3,
                "reps": 12,
                "weight": None,
            },
            {
                "name": "Mountain Climbers",
                "sets": 3,
                "reps": 20,
                "weight": None,
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Seed the default Dyno Fitness workout templates."

    def handle(self, *args, **options):
        created = 0
        skipped = 0

        for template in TEMPLATES:
            existing = get_template_by_key(
                template["template_key"]
            )

            if existing:
                skipped += 1
                self.stdout.write(
                    f"Skipped: {template['name']}"
                )
                continue

            create_template(template)
            created += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Created: {template['name']}"
                )
            )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Workout seed complete — created={created}, skipped={skipped}"
            )
        )