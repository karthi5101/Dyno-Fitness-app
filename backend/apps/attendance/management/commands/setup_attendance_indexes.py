from django.core.management.base import BaseCommand

from apps.attendance.database import get_attendance_collection


class Command(BaseCommand):
    help = "Create the unique attendance index for member/date combinations."

    def handle(self, *args, **options):
        collection = get_attendance_collection()

        index_name = collection.create_index(
            [
                ("member_id", 1),
                ("attendance_date", 1),
            ],
            unique=True,
            name="member_attendance_date_unique",
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Attendance unique index is ready: {index_name}"
            )
        )