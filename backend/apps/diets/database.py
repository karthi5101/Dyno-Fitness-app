from core.database.mongodb import MongoDB


DIET_TEMPLATES_COLLECTION = "diet_templates"
DIET_ASSIGNMENTS_COLLECTION = "diet_assignments"


def get_diet_templates_collection():
    database = MongoDB.get_database()

    return database[DIET_TEMPLATES_COLLECTION]


def get_diet_assignments_collection():
    database = MongoDB.get_database()

    return database[DIET_ASSIGNMENTS_COLLECTION]