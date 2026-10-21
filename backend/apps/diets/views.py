from bson import ObjectId
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.identity import get_member_id_for_user
from apps.authentication.permissions import IsStaffOrReadOnly
from apps.diets.repositories import (
    create_diet_assignment,
    create_diet_template,
    get_all_diet_assignments,
    get_all_diet_templates,
    get_diet_template_by_key,
)
from apps.diets.serializers import (
    DietAssignmentSerializer,
    DietTemplateSerializer,
)


def serialize_datetime(value):
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def serialize_diet_template(document):
    if not document:
        return None

    return {
        "id": str(document["_id"]),
        "template_key": document["template_key"],
        "name": document["name"],
        "description": document.get(
            "description",
            "",
        ),
        "target_calories": document.get(
            "target_calories",
        ),
        "meals": document.get(
            "meals",
            [],
        ),
        "created_at": serialize_datetime(
            document.get("created_at"),
        ),
        "updated_at": serialize_datetime(
            document.get("updated_at"),
        ),
    }


def serialize_diet_assignment(document):
    if not document:
        return None

    return {
        "id": str(document["_id"]),
        "member_id": document["member_id"],
        "template_key": document["template_key"],
        "assigned_date": serialize_datetime(
            document.get("assigned_date"),
        ),
        "status": document.get(
            "status",
            "active",
        ),
        "notes": document.get(
            "notes",
            "",
        ),
        "created_at": serialize_datetime(
            document.get("created_at"),
        ),
        "updated_at": serialize_datetime(
            document.get("updated_at"),
        ),
    }


class DietTemplateListCreateView(APIView):

    permission_classes = [IsStaffOrReadOnly]

    def get(self, request):
        templates = get_all_diet_templates()

        return Response(
            [
                serialize_diet_template(template)
                for template in templates
            ],
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = DietTemplateSerializer(
            data=request.data,
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        template_key = serializer.validated_data[
            "template_key"
        ]

        existing = get_diet_template_by_key(
            template_key,
        )

        if existing is not None:
            return Response(
                {
                    "detail": (
                        "Diet template already exists."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        template = create_diet_template(
            serializer.validated_data,
        )

        return Response(
            serialize_diet_template(template),
            status=status.HTTP_201_CREATED,
        )


class DietAssignmentListCreateView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        assignments = get_all_diet_assignments()

        if not request.user.is_staff:
            own_member_id = get_member_id_for_user(
                request.user
            )

            assignments = [
                assignment
                for assignment in assignments
                if str(assignment.get("member_id"))
                == str(own_member_id)
            ]

        return Response(
            [
                serialize_diet_assignment(assignment)
                for assignment in assignments
            ],
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "assign diets."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = DietAssignmentSerializer(
            data=request.data,
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        template_key = serializer.validated_data[
            "template_key"
        ]

        template = get_diet_template_by_key(
            template_key,
        )

        if template is None:
            return Response(
                {
                    "detail": (
                        "Diet template does not exist."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment = create_diet_assignment(
            serializer.validated_data,
        )

        return Response(
            serialize_diet_assignment(assignment),
            status=status.HTTP_201_CREATED,
        )