from django.core.management.base import BaseCommand

from apps.transformations.indexes import (
    setup_transformation_indexes,
)


class Command(BaseCommand):
    help = "Create MongoDB indexes for the Transformation Tracking module."

    def handle(self, *args, **options):
        indexes = setup_transformation_indexes()

        self.stdout.write(
            self.style.SUCCESS(
                "Transformation Tracking MongoDB indexes are ready."
            )
        )

        for index_name in indexes:
            self.stdout.write(
                f" - {index_name}"
            )