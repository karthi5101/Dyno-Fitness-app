from core.database.mongodb import MongoDB


EXERCISES_COLLECTION = "trn_exercises"
PROGRAMS_COLLECTION = "trn_programs"
ASSIGNMENTS_COLLECTION = "trn_assignments"
SESSIONS_COLLECTION = "trn_sessions"
ASSIGNMENT_HISTORY_COLLECTION = "trn_assignment_history"


def get_exercises_collection():
    return MongoDB.get_database()[EXERCISES_COLLECTION]


def get_programs_collection():
    return MongoDB.get_database()[PROGRAMS_COLLECTION]


def get_assignments_collection():
    return MongoDB.get_database()[ASSIGNMENTS_COLLECTION]


def get_sessions_collection():
    return MongoDB.get_database()[SESSIONS_COLLECTION]


def get_assignment_history_collection():
    return MongoDB.get_database()[ASSIGNMENT_HISTORY_COLLECTION]
