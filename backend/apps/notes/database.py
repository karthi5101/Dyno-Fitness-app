from core.database.mongodb import MongoDB


COLLECTION_NAME = "member_notes"


def get_notes_collection():
    """
    Return the MongoDB collection used for Dyno Fitness
    staff notes about a member.
    """

    db = MongoDB.get_database()

    return db[COLLECTION_NAME]
