"""
Session definitions for the Dyno Fitness gym.

Sessions are fixed time slots.
Actual attendance is handled by the attendance module.
"""


SESSION_DEFINITIONS = {
    "morning_first": {
        "name": "Morning - First Half",
        "period": "morning",
        "half": "first",
        "start_time": "05:30",
        "end_time": "07:30",
    },
    "morning_second": {
        "name": "Morning - Second Half",
        "period": "morning",
        "half": "second",
        "start_time": "07:30",
        "end_time": "09:30",
    },
    "evening_first": {
        "name": "Evening - First Half",
        "period": "evening",
        "half": "first",
        "start_time": "17:30",
        "end_time": "19:30",
    },
    "evening_second": {
        "name": "Evening - Second Half",
        "period": "evening",
        "half": "second",
        "start_time": "19:30",
        "end_time": "21:30",
    },
}


def get_session_definition(session_key):
    return SESSION_DEFINITIONS.get(session_key)


def get_all_session_definitions():
    return SESSION_DEFINITIONS