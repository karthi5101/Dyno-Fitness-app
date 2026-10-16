from apps.transformations.database import (
    get_transformations_collection,
)


def setup_transformation_indexes():
    collection = get_transformations_collection()

    collection.create_index(
        [
            ("member_id", 1),
            ("week_number", 1),
        ],
        name="transformation_member_week_unique",
        unique=True,
    )

    collection.create_index(
        [
            ("member_id", 1),
            ("recorded_date", -1),
        ],
        name="transformation_member_date",
    )

    collection.create_index(
        [
            ("recorded_date", -1),
        ],
        name="transformation_recorded_date",
    )

    return collection.index_information()