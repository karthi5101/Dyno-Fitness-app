
from datetime import date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.identity import get_member_id_for_user
from apps.authentication.permissions import (
    IsStaffUser,
    MemberScopedAccess,
)

from apps.workouts.repositories import (
    assign_template,
    create_daily_workout,
    create_daily_workout_from_assignment,
    create_template,
    delete_daily_workout,
    delete_template,
    get_all_templates,
    get_assignment_by_member,
    get_daily_workout,
    get_member_workout_history,
    get_template,
    sync_member_daily_workout_with_assignment,
    update_daily_workout,
    update_template,
)
from apps.workouts.serializers import (
    DailyWorkoutGenerateSerializer,
    DailyWorkoutSerializer,
    DailyWorkoutUpdateSerializer,
    WorkoutAssignmentSerializer,
    WorkoutTemplateSerializer,
    WorkoutTemplateUpdateSerializer,
)


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def serialize_datetime(value):
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def serialize_exercise(exercise):
    return {
        "name": exercise.get("name"),
        "sets": exercise.get("sets"),
        "reps": exercise.get("reps"),
        "weight": exercise.get("weight"),
        "order": exercise.get("order"),
    }


def serialize_template(document):
    if not document:
        return None

    return {
        "id": str(document["_id"]),
        "template_key": document["template_key"],
        "name": document["name"],
        "description": document.get("description", ""),
        "exercises": [
            serialize_exercise(exercise)
            for exercise in document.get("exercises", [])
        ],
        "created_at": serialize_datetime(
            document.get("created_at")
        ),
        "updated_at": serialize_datetime(
            document.get("updated_at")
        ),
    }


def serialize_assignment(document, template=None):
    if not document:
        return None

    return {
        "id": str(document["_id"]),
        "member_id": document["member_id"],
        "template_id": str(document["template_id"]),
        "template_key": document["template_key"],
        "template_name": document["template_name"],
        "exercises": [
            serialize_exercise(exercise)
            for exercise in (template or {}).get(
                "exercises",
                [],
            )
        ],
        "created_at": serialize_datetime(
            document.get("created_at")
        ),
        "updated_at": serialize_datetime(
            document.get("updated_at")
        ),
    }


def serialize_daily_workout(document):
    if not document:
        return None

    return {
        "id": str(document["_id"]),
        "member_id": document["member_id"],
        "workout_date": serialize_datetime(
            document["workout_date"]
        ),
        "template_id": (
            str(document["template_id"])
            if document.get("template_id")
            else None
        ),
        "template_key": document.get("template_key"),
        "exercises": [
            serialize_exercise(exercise)
            for exercise in document.get("exercises", [])
        ],
        "created_at": serialize_datetime(
            document.get("created_at")
        ),
        "updated_at": serialize_datetime(
            document.get("updated_at")
        ),
    }


# ---------------------------------------------------------------------------
# Workout Templates
# ---------------------------------------------------------------------------

class WorkoutTemplateListCreateView(APIView):

    permission_classes = [IsStaffUser]

    def get(self, request):
        templates = get_all_templates()

        return Response(
            [
                serialize_template(template)
                for template in templates
            ],
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "create a workout template."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = WorkoutTemplateSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            template = create_template(
                serializer.validated_data
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            serialize_template(template),
            status=status.HTTP_201_CREATED,
        )


class WorkoutTemplateDetailView(APIView):

    permission_classes = [IsStaffUser]

    def get(self, request, template_id):
        template = get_template(template_id)

        if template is None:
            return Response(
                {"detail": "Workout template not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_template(template),
            status=status.HTTP_200_OK,
        )

    def put(self, request, template_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "update a workout template."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = WorkoutTemplateUpdateSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            template = update_template(
                template_id,
                serializer.validated_data,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if template is None:
            return Response(
                {"detail": "Workout template not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_template(template),
            status=status.HTTP_200_OK,
        )

    def delete(self, request, template_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "delete a workout template."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            deleted = delete_template(
                template_id
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not deleted:
            return Response(
                {"detail": "Workout template not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )


# ---------------------------------------------------------------------------
# Workout Assignment
# ---------------------------------------------------------------------------

class WorkoutAssignmentView(APIView):

    permission_classes = [MemberScopedAccess]

    def get(self, request, member_id):
        assignment = get_assignment_by_member(
            member_id
        )

        if assignment is None:
            return Response(
                {
                    "detail": (
                        "No workout template assigned "
                        "to this member."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        template = get_template(
            assignment.get("template_id")
        )

        return Response(
            serialize_assignment(
                assignment,
                template,
            ),
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "assign a workout."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = WorkoutAssignmentSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            assignment = assign_template(
                serializer.validated_data["member_id"],
                serializer.validated_data["template_id"],
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        template = get_template(
            assignment.get("template_id")
        )

        return Response(
            serialize_assignment(
                assignment,
                template,
            ),
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Daily Workout Generation
# ---------------------------------------------------------------------------

class DailyWorkoutGenerateView(APIView):

    permission_classes = [IsStaffUser]

    def post(self, request):
        serializer = DailyWorkoutGenerateSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        member_id = serializer.validated_data[
            "member_id"
        ]

        workout_date = serializer.validated_data.get(
            "workout_date",
            date.today(),
        )

        try:
            existing = get_daily_workout(
                member_id,
                workout_date,
            )

            if existing is not None:
                return Response(
                    {
                        "detail": (
                            "Daily workout already exists "
                            "for this member on this date."
                        ),
                        "workout": serialize_daily_workout(
                            existing
                        ),
                    },
                    status=status.HTTP_200_OK,
                )

            workout = create_daily_workout_from_assignment(
                member_id,
                workout_date,
            )

        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            serialize_daily_workout(workout),
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Daily Workout
# ---------------------------------------------------------------------------

class DailyWorkoutView(APIView):

    permission_classes = [MemberScopedAccess]

    def get(self, request, member_id):
        workout_date = request.query_params.get(
            "date"
        )

        if workout_date:
            try:
                workout_date = date.fromisoformat(
                    workout_date
                )
            except ValueError:
                return Response(
                    {
                        "detail": (
                            "Invalid date. Use YYYY-MM-DD."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            workout_date = date.today()

        workout = get_daily_workout(
            member_id,
            workout_date,
        )

        if workout is None:
            return Response(
                {"detail": "Daily workout not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_daily_workout(workout),
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = DailyWorkoutSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        assignment = get_assignment_by_member(
            data["member_id"]
        )

        template_id = None
        template_key = None

        if assignment:
            template_id = assignment.get(
                "template_id"
            )
            template_key = assignment.get(
                "template_key"
            )

        try:
            workout = create_daily_workout(
                member_id=data["member_id"],
                workout_date=data["workout_date"],
                exercises=data["exercises"],
                template_id=template_id,
                template_key=template_key,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            serialize_daily_workout(workout),
            status=status.HTTP_201_CREATED,
        )

    def put(self, request, member_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "update a daily workout."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = DailyWorkoutUpdateSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        workout_date = request.query_params.get(
            "date"
        )

        if workout_date:
            try:
                workout_date = date.fromisoformat(
                    workout_date
                )
            except ValueError:
                return Response(
                    {
                        "detail": (
                            "Invalid date. Use YYYY-MM-DD."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            workout_date = date.today()

        try:
            workout = update_daily_workout(
                member_id,
                workout_date,
                serializer.validated_data["exercises"],
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if workout is None:
            return Response(
                {"detail": "Daily workout not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_daily_workout(workout),
            status=status.HTTP_200_OK,
        )

    def delete(self, request, member_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "delete a daily workout."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        workout_date = request.query_params.get(
            "date"
        )

        if workout_date:
            try:
                workout_date = date.fromisoformat(
                    workout_date
                )
            except ValueError:
                return Response(
                    {
                        "detail": (
                            "Invalid date. Use YYYY-MM-DD."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            workout_date = date.today()

        if not delete_daily_workout(
            member_id,
            workout_date,
        ):
            return Response(
                {"detail": "Daily workout not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )


# ---------------------------------------------------------------------------
# Workout History
# ---------------------------------------------------------------------------

class WorkoutHistoryView(APIView):

    permission_classes = [MemberScopedAccess]

    def get(self, request, member_id):
        workouts = get_member_workout_history(
            member_id
        )

        return Response(
            [
                serialize_daily_workout(workout)
                for workout in workouts
            ],
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Daily Workout Sync
# ---------------------------------------------------------------------------

class WorkoutSyncView(APIView):

    permission_classes = [IsStaffUser]

    def post(self, request):
        serializer = DailyWorkoutGenerateSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        member_id = serializer.validated_data[
            "member_id"
        ]

        workout_date = serializer.validated_data.get(
            "workout_date",
            date.today(),
        )

        try:
            workout = sync_member_daily_workout_with_assignment(
                member_id,
                workout_date,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            serialize_daily_workout(workout),
            status=status.HTTP_200_OK,
        )

