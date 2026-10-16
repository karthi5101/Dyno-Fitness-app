from core.database.mongodb import MongoDB


WORKOUTS_COLLECTION = "workout_templates"
ASSIGNMENTS_COLLECTION = "workout_assignments"
DAILY_WORKOUTS_COLLECTION = "daily_workouts"


def get_workout_templates_collection():
    database = MongoDB.get_database()

    return database[WORKOUTS_COLLECTION]


def get_workout_assignments_collection():
    database = MongoDB.get_database()

    return database[ASSIGNMENTS_COLLECTION]


def get_daily_workouts_collection():
    database = MongoDB.get_database()

    return database[DAILY_WORKOUTS_COLLECTION]

