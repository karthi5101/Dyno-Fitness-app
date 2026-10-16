from django.core.management.base import BaseCommand

from apps.membership.indexes import ensure_membership_indexes


class Command(BaseCommand):
    help = "Create required MongoDB indexes for membership data."

    def handle(self, *args, **options):
        ensure_membership_indexes()

        self.stdout.write(
            self.style.SUCCESS(
                "Membership indexes created successfully."
            )
        )