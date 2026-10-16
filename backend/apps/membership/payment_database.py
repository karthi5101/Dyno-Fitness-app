from core.database.mongodb import MongoDB


COLLECTION_NAME = "payments"


def get_payments_collection():
    database = MongoDB.get_database()

    return database[COLLECTION_NAME]