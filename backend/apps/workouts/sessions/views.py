from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.identity import get_member_id_for_user
from apps.authentication.permissions import IsStaffUser

from ..flag import TrainingEnabledAPIView
from .repositories import (
    SessionError,
    abandon_stale_sessions,
    complete_session,
    get_session,
    get_today,
    history,
    last_exercise,
    log_sets,
    plan,
    start_session,
    add_correction,
    repair_completed_advancements,
    serialize_session,
    serialize_session_summary,
)

from ..assignments.repositories import get_active_assignment


def _error(exc):
    return Response(
        {"detail": str(exc)},
        status=getattr(exc, "status_code", status.HTTP_400_BAD_REQUEST),
    )


class TodayView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        member_id = get_member_id_for_user(request.user)
        if not member_id:
            return Response(
                {"detail": "No member profile linked to this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            result = get_today(member_id)
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(result)


class SessionDetailView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        member_id = get_member_id_for_user(request.user)
        if not member_id:
            return Response(
                {"detail": "No member profile linked to this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            session = get_session(member_id, session_id)
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(serialize_session(session))


class SessionStartView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        member_id = get_member_id_for_user(request.user)
        if not member_id:
            return Response(
                {"detail": "No member profile linked to this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            session = start_session(member_id)
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(serialize_session(session))


class SessionCompleteView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        member_id = get_member_id_for_user(request.user)
        if not member_id:
            return Response(
                {"detail": "No member profile linked to this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            session, already = complete_session(member_id, session_id)
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(
            {
                "session": serialize_session(session),
                "already_completed": already,
            }
        )


class SessionSetsView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, session_id):
        member_id = get_member_id_for_user(request.user)
        if not member_id:
            return Response(
                {"detail": "No member profile linked to this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            session, applied = log_sets(member_id, session_id, request.data)
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(
            {
                "session": serialize_session(session),
                "sets_applied": applied,
            }
        )


class LastExerciseView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exercise_id):
        member_id = get_member_id_for_user(request.user)
        if not member_id:
            return Response(
                {"detail": "No member profile linked to this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            result = last_exercise(member_id, exercise_id)
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        if result is None:
            return Response(
                {"detail": "No completed sets found for this exercise."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(result)


class HistoryView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        member_id = get_member_id_for_user(request.user)
        if not member_id:
            return Response(
                {"detail": "No member profile linked to this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            result = history(member_id)
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(result)


class PlanView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        member_id = get_member_id_for_user(request.user)
        if not member_id:
            return Response(
                {"detail": "No member profile linked to this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            result = plan(member_id)
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(result)


class CorrectionsView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def post(self, request, session_id):
        try:
            username = request.user.username
            session = add_correction(
                session_id, username, request.data
            )
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(serialize_session(session))


class StaffHistoryView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request, member_id):
        try:
            result = history(member_id)
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(result)


class StaffAdherenceView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request, member_id):
        try:
            from ..assignments.repositories import adherence as _adherence

            result = _adherence(member_id)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(result)


class StaffPlanView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request, member_id):
        try:
            result = plan(member_id)
        except SessionError as exc:
            return _error(exc)
        except Exception as exc:
            return _error(
                SessionError(
                    f"An unexpected error occurred: {exc}",
                    status_code=getattr(exc, "status_code", 500),
                )
            )
        return Response(result)
