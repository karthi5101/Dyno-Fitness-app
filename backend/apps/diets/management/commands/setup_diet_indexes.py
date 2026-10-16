from django.core.management.base import BaseCommand

from apps.diets.indexes import ensure_diet_indexes


class Command(BaseCommand):
    help = "Create and verify MongoDB indexes for the Diet module."

    def handle(self, *args, **options):
        index_information = ensure_diet_indexes()

        self.stdout.write(
            self.style.SUCCESS(
                "Diet MongoDB indexes are ready."
            )
        )

        self.stdout.write("Diet template indexes:")

        for name in index_information["templates"]:
            self.stdout.write(f" - {name}")

        self.stdout.write("Diet assignment indexes:")

        for name in index_information["assignments"]:
            self.stdout.write(f" - {name}")