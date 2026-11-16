from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import IsStaffUser

from ..flag import TrainingEnabledAPIView
from .repositories import (
    program_archive,
    program_create,
    program_detail,
    program_duplicate,
    program_list,
    program_update,
    serialize_program,
)


class ProgramListCreateView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", 20))
        except (TypeError, ValueError):
            limit = 20

        limit = max(1, min(limit, 50))
        archived = request.query_params.get("archived")

        programs, next_cursor = program_list(
            filters={
                "archived": (
                    archived.lower() == "true"
                    if archived is not None
                    else None
                ),
                "level": request.query_params.get("level", ""),
                "goal": request.query_params.get("goal", ""),
            },
            limit=limit,
            cursor=request.query_params.get("cursor"),
        )

        return Response(
            {
                "results": [
                    serialize_program(program) for program in programs
                ],
                "next_cursor": next_cursor,
            }
        )

    def post(self, request):
        try:
            program, _ = program_create(
                request.data,
                request.user.username,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"program": serialize_program(program)},
            status=status.HTTP_201_CREATED,
        )


class ProgramDetailView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request, program_id):
        program = program_detail(program_id)

        if program is None:
            return Response(
                {"detail": "Program not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({"program": serialize_program(program)})

    def put(self, request, program_id):
        try:
            program = program_update(
                program_id,
                request.data,
                request.user.username,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if program is None:
            return Response(
                {"detail": "Program not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({"program": serialize_program(program)})


class ProgramDuplicateView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def post(self, request, program_id):
        try:
            program = program_duplicate(
                program_id,
                request.user.username,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if program is None:
            return Response(
                {"detail": "Program not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {"program": serialize_program(program)},
            status=status.HTTP_201_CREATED,
        )


class ProgramArchiveView(TrainingEnabledAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def post(self, request, program_id):
        if not program_archive(program_id):
            return Response(
                {"detail": "Program not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        program = program_detail(program_id)

        return Response(
            {
                "detail": "Program archived.",
                "program": serialize_program(program),
            }
        )
