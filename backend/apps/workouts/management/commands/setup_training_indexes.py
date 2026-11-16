from django.core.management.base import BaseCommand

from apps.workouts.indexes import ensure_indexes


class Command(BaseCommand):
    help = "Create the training module MongoDB indexes."

    def handle(self, *args, **options):
        ensure_indexes()
        self.stdout.write(
            self.style.SUCCESS("Training indexes ensured.")
        )
