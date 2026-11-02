from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import IsStaffUser

from ..flag import TrainingEnabledAPIView
from .repositories import (
    AssignmentError,
    adherence,
    create_assignment,
    end_assignment,
    get_active_assignment,
    get_member,
    list_assignments,
    list_history,
    serialize_assignment,
    serialize_history,
    update_assignment,
)


def _error(exc):
    return Response(
        {"detail": str(exc)},
        status=getattr(
            exc,
            "status_code",
            status.HTTP_400_BAD_REQUEST,
        ),
    )


class MemberAssignmentView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request, member_id):
        if get_member(member_id) is None:
            return Response(
                {"detail": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        active = get_active_assignment(member_id)

        return Response(
            {
                "assignment": serialize_assignment(active),
                "assignments": [
                    serialize_assignment(assignment)
                    for assignment in list_assignments(member_id)
                ],
            }
        )

    def post(self, request, member_id):
        try:
            assignment = create_assignment(
                member_id,
                request.data,
                request.user.username,
            )
        except AssignmentError as exc:
            return _error(exc)

        return Response(
            {"assignment": serialize_assignment(assignment)},
            status=status.HTTP_201_CREATED,
        )

    def patch(self, request, member_id):
        try:
            assignment = update_assignment(
                member_id,
                request.data,
                request.user.username,
            )
        except AssignmentError as exc:
            return _error(exc)

        return Response(
            {"assignment": serialize_assignment(assignment)}
        )


class MemberAssignmentEndView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def post(self, request, member_id):
        try:
            assignment = end_assignment(
                member_id,
                request.user.username,
            )
        except AssignmentError as exc:
            return _error(exc)

        return Response(
            {
                "detail": "Assignment ended.",
                "assignment": serialize_assignment(assignment),
            }
        )


class MemberHistoryView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request, member_id):
        if get_member(member_id) is None:
            return Response(
                {"detail": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "assignments": [
                    serialize_assignment(assignment)
                    for assignment in list_assignments(member_id)
                ],
                "history": [
                    serialize_history(record)
                    for record in list_history(member_id)
                ],
            }
        )


class MemberAdherenceView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request, member_id):
        if get_member(member_id) is None:
            return Response(
                {"detail": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(adherence(member_id))
