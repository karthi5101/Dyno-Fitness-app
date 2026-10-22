from datetime import date, timedelta

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.identity import get_member_id_for_user
from apps.authentication.permissions import IsStaffUser
from apps.members.database import get_members_collection

from .models import get_all_session_definitions
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

    permission_classes = [IsStaffUser]

    def get(self, request):
        overview = get_session_overview(date.today())

        return Response(overview)


class SessionTomorrowView(APIView):
    """
    Return the complete expected session overview for tomorrow.
    """

    permission_classes = [IsStaffUser]

    def get(self, request):
        tomorrow = date.today() + timedelta(days=1)

        overview = get_session_overview(tomorrow)

        return Response(overview)


class SessionClientTodayView(APIView):
    """
    Client-safe view for today's sessions.

    Member identities are intentionally removed.
    """

    permission_classes = [IsStaffUser]

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

    permission_classes = [IsStaffUser]

    def get(self, request):
        overview = get_session_overview(date.today())

        return Response(overview)


class SessionOptionsView(APIView):
    """
    Return the fixed gym session slots.

    Any authenticated account may read this list so that
    members can choose their own default session.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = [
            {
                "session_key": session_key,
                "name": definition["name"],
                "period": definition["period"],
                "half": definition["half"],
                "start_time": definition["start_time"],
                "end_time": definition["end_time"],
            }
            for session_key, definition
            in get_all_session_definitions().items()
        ]

        return Response(
            {
                "sessions": sessions,
            },
            status=status.HTTP_200_OK,
        )


class SessionPreferenceView(APIView):
    """
    Read or update the authenticated member's default
    gym session.

    The member identity always comes from the JWT.
    A member_id in the request body is never accepted.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        member_id = get_member_id_for_user(request.user)

        if member_id is None:
            return Response(
                {
                    "detail": (
                        "This account is not linked "
                        "to a Dyno member."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        member = get_members_collection().find_one(
            {
                "member_id": member_id,
            },
            {
                "_id": 0,
                "member_id": 1,
                "preferred_session": 1,
            },
        )

        if member is None:
            return Response(
                {"detail": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "member_id": member_id,
                "preferred_session": member.get(
                    "preferred_session",
                ),
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        member_id = get_member_id_for_user(request.user)

        if member_id is None:
            return Response(
                {
                    "detail": (
                        "This account is not linked "
                        "to a Dyno member."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        session_key = request.data.get("session_key")

        if not isinstance(session_key, str):
            return Response(
                {
                    "session_key": [
                        "A valid session key is required.",
                    ],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        session_key = session_key.strip().lower()

        if session_key not in get_all_session_definitions():
            return Response(
                {
                    "session_key": [
                        "Unknown gym session.",
                    ],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        collection = get_members_collection()

        result = collection.update_one(
            {
                "member_id": member_id,
            },
            {
                "$set": {
                    "preferred_session": session_key,
                },
            },
        )

        if result.matched_count == 0:
            return Response(
                {"detail": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "detail": "Default session updated.",
                "member_id": member_id,
                "preferred_session": session_key,
            },
            status=status.HTTP_200_OK,
        )