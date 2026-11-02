from .database import (
    get_assignment_history_collection,
    get_assignments_collection,
    get_exercises_collection,
    get_sessions_collection,
)


def ensure_indexes():
    exercises = get_exercises_collection()
    exercises.create_index(
        "slug",
        unique=True,
        name="unique_trn_exercise_slug",
    )
    exercises.create_index(
        "name_lc",
        name="trn_exercise_name_lc",
    )

    assignments = get_assignments_collection()
    assignments.create_index(
        "member_id",
        unique=True,
        partialFilterExpression={"status": "active"},
        name="unique_active_trn_assignment",
    )
    assignments.create_index(
        "status",
        name="trn_assignment_status",
    )

    sessions = get_sessions_collection()
    sessions.create_index(
        [
            ("member_id", 1),
            ("session_date", 1),
        ],
        unique=True,
        name="unique_trn_member_session_date",
    )
    sessions.create_index(
        [
            ("member_id", 1),
            ("status", 1),
        ],
        name="trn_session_member_status",
    )

    history = get_assignment_history_collection()
    history.create_index(
        "assignment_id",
        name="trn_assignment_history_assignment",
    )
    history.create_index(
        "member_id",
        name="trn_assignment_history_member",
    )
