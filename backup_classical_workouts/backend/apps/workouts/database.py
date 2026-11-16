import logging

from pymongo.errors import PyMongoError

from core.database.mongodb import MongoDB


logger = logging.getLogger(__name__)

WORKOUTS_COLLECTION = "workout_templates"
ASSIGNMENTS_COLLECTION = "workout_assignments"
DAILY_WORKOUTS_COLLECTION = "daily_workouts"

_daily_indexes_ready = False


def get_workout_templates_collection():
    database = MongoDB.get_database()

    return database[WORKOUTS_COLLECTION]


def get_workout_assignments_collection():
    database = MongoDB.get_database()

    return database[ASSIGNMENTS_COLLECTION]


def get_daily_workouts_collection():
    global _daily_indexes_ready

    database = MongoDB.get_database()
    collection = database[DAILY_WORKOUTS_COLLECTION]

    if not _daily_indexes_ready:
        try:
            collection.create_index(
                [
                    ("member_id", 1),
                    ("workout_date", 1),
                ],
                unique=True,
                name="unique_member_workout_date",
            )
        except PyMongoError:
            # Existing duplicate documents prevent the index from
            # being created. The application still works, but the
            # one-workout-per-member-per-date race is not protected.
            logger.warning(
                "Could not create the unique daily workout index.",
                exc_info=True,
            )

        _daily_indexes_ready = True

    return collection

