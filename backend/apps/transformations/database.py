from core.database.mongodb import MongoDB


TRANSFORMATIONS_COLLECTION = "transformations"


def get_transformations_collection():
    database = MongoDB.get_database()

    return database[TRANSFORMATIONS_COLLECTION]