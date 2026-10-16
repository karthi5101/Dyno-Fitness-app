from datetime import date, timedelta

from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_session_overview


def build_client_response(overview):
    sessions = []

    for session in overview["sessions"]:
        sessions.append(
            {
                "session_key": session["session_key"],
                "name": session["name"],
                "period": session["period"],
                "half": session["half"],
                "start_time": session["start_time"],
                "end_time": session["end_time"],
                "expected_count": session["expected_count"],
                "present_count": session["present_count"],
            }
        )

    return {
        "date": overview["date"],
        "total_present": overview["total_present"],
        "total_expected": overview["total_expected"],
        "sessions": sessions,
    }


class SessionTodayView(APIView):
    """
    Return the complete session overview for today.

    This endpoint is intended for internal/trainer use.
    """

    def get(self, request):
        overview = get_session_overview(date.today())

        return Response(overview)


class SessionTomorrowView(APIView):
    """
    Return the complete expected session overview for tomorrow.
    """

    def get(self, request):
        tomorrow = date.today() + timedelta(days=1)

        overview = get_session_overview(tomorrow)

        return Response(overview)


class SessionClientTodayView(APIView):
    """
    Client-safe view for today's sessions.

    Member identities are intentionally removed.
    """

    def get(self, request):
        overview = get_session_overview(date.today())

        return Response(
            build_client_response(overview)
        )


class SessionTrainerTodayView(APIView):
    """
    Trainer/owner view for today's sessions.

    Includes present member IDs and names.
    """

    def get(self, request):
        overview = get_session_overview(date.today())

        return Response(overview)