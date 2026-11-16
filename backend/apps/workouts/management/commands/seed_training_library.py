import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from pymongo import UpdateOne

from apps.workouts.database import get_exercises_collection
from apps.workouts.indexes import ensure_indexes
from apps.workouts.library.utils import (
    normalize_text,
    normalize_text_list,
    slugify_exercise_id,
    tracking_type_for,
)


class Command(BaseCommand):
    help = "Seed the training exercise library from free-exercise-db."

    def handle(self, *args, **options):
        seed_path = (
            Path(__file__).resolve().parents[2]
            / "seed"
            / "exercises.json"
        )

        if not seed_path.is_file():
            raise CommandError(
                f"Seed file not found: {seed_path}"
            )

        try:
            data = json.loads(
                seed_path.read_text(encoding="utf-8")
            )
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(
                f"Unable to read seed file: {exc}"
            ) from exc

        if not isinstance(data, list):
            raise CommandError(
                "Seed file must contain a JSON array."
            )

        ensure_indexes()
        collection = get_exercises_collection()
        custom_slugs = {
            document["slug"]
            for document in collection.find(
                {"is_custom": True},
                {"slug": 1},
            )
            if document.get("slug")
        }
        now = timezone.now()
        operations = []
        skipped_custom = 0

        for item in data:
            if not isinstance(item, dict):
                continue

            name = normalize_text(item.get("name"))
            slug = slugify_exercise_id(
                item.get("id") or name
            )

            if not name or not slug:
                continue

            if slug in custom_slugs:
                skipped_custom += 1
                continue

            images = item.get("images") or []
            equipment = (
                normalize_text(item.get("equipment")).lower()
                or "other"
            )
            category = (
                normalize_text(item.get("category")).lower()
                or "strength"
            )

            operations.append(
                UpdateOne(
                    {"slug": slug},
                    {
                        "$set": {
                            "slug": slug,
                            "name": name,
                            "name_lc": name.lower(),
                            "primary_muscles": normalize_text_list(
                                item.get("primaryMuscles"),
                                lowercase=True,
                            ),
                            "secondary_muscles": normalize_text_list(
                                item.get("secondaryMuscles"),
                                lowercase=True,
                            ),
                            "equipment": equipment,
                            "level": (
                                normalize_text(
                                    item.get("level")
                                ).lower()
                                or "beginner"
                            ),
                            "category": category,
                            "instructions": normalize_text_list(
                                item.get("instructions")
                            ),
                            "images": (
                                [f"{slug}/0.jpg"]
                                if images
                                else []
                            ),
                            "video_file_id": None,
                            "tracking_type": tracking_type_for(
                                category,
                                equipment,
                            ),
                            "updated_at": now,
                        },
                        "$setOnInsert": {
                            "is_custom": False,
                            "created_by": None,
                            "archived": False,
                            "favorite_by": [],
                            "created_at": now,
                        },
                    },
                    upsert=True,
                )
            )

        result = (
            collection.bulk_write(operations, ordered=False)
            if operations
            else None
        )
        total = collection.count_documents(
            {"is_custom": False}
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Training library seeded: "
                f"total={total} "
                f"upserted={getattr(result, 'upserted_count', 0)} "
                f"modified={getattr(result, 'modified_count', 0)} "
                f"skipped_custom={skipped_custom}"
            )
        )
