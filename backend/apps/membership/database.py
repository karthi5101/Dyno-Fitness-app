from core.database.mongodb import MongoDB


COLLECTION_NAME = "memberships"


def get_memberships_collection():
    database = MongoDB.get_database()

    return database[COLLECTION_NAME]