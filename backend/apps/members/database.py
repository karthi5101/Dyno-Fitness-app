from core.database.mongodb import MongoDB


def get_members_collection():
    """
    Return the MongoDB collection used for Dyno Fitness members.
    """
    database = MongoDB.get_database()
    return database["members"]