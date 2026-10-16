from django.core.management.base import BaseCommand

from apps.membership.payment_indexes import (
    ensure_payment_indexes,
)


class Command(BaseCommand):
    help = "Create required MongoDB indexes for payment data."

    def handle(self, *args, **options):
        ensure_payment_indexes()

        self.stdout.write(
            self.style.SUCCESS(
                "Payment indexes created successfully."
            )
        )