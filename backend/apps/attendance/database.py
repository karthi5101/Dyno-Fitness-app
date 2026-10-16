from core.database.mongodb import MongoDB


def get_attendance_collection():
    """
    Return the MongoDB collection used for Dyno Fitness attendance.
    """
    database = MongoDB.get_database()
    return database["attendance"]