from django.core.management.base import BaseCommand

from apps.members.indexes import ensure_member_indexes


class Command(BaseCommand):
    help = "Create required MongoDB indexes for the Members module."

    def handle(self, *args, **options):
        ensure_member_indexes()

        self.stdout.write(
            self.style.SUCCESS(
                "Member indexes are ready."
            )
        )