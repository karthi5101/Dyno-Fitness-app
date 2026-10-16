from .database import get_attendance_collection


def ensure_attendance_indexes():
    """
    Create indexes required by the Attendance collection.
    """
    collection = get_attendance_collection()

    collection.create_index(
        [
            ("member_id", 1),
            ("date", 1),
        ],
        unique=True,
        name="member_date_unique",
    )