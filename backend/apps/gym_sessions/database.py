from core.database.mongodb import MongoDB


COLLECTION_NAME = "gym_sessions"


def get_sessions_collection():
    db = MongoDB.get_database()

    return db[COLLECTION_NAME]