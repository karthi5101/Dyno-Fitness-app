from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import (
    IsStaffUser,
    MemberScopedAccess,
)
from apps.transformations.repositories import (
    create_transformation,
    delete_transformation,
    get_all_transformations,
    get_transformation_by_id,
    get_transformation_by_member_and_week,
    get_transformations_by_member,
    update_transformation,
)
from apps.transformations.serializers import (
    TransformationSerializer,
)


def serialize_datetime(value):
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def serialize_transformation(document):
    if not document:
        return None

    weight = document.get("weight_kg")

    if weight is None:
        weight_value = None
    else:
        weight_value = f"{float(weight):.2f}"

    return {
        "id": str(document["_id"]),
        "transformation_id": str(document["_id"]),

        "member_id": document["member_id"],

        "week_number": document["week_number"],

        "recorded_date": serialize_datetime(
            document.get("recorded_date"),
        ),

        "weight_kg": weight_value,

        # -------------------------------------------------
        # Transformation images
        #
        # New front/back workflow
        # -------------------------------------------------

        "front_image_url": document.get(
            "front_image_url",
            "",
        ),

        "back_image_url": document.get(
            "back_image_url",
            "",
        ),

        # -------------------------------------------------
        # Backward compatibility with the original
        # single-image transformation workflow.
        # -------------------------------------------------

        "image_url": document.get(
            "image_url",
            "",
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


class TransformationListCreateView(APIView):

    permission_classes = [IsStaffUser]

    def get(self, request):
        member_id = request.query_params.get(
            "member_id",
        )

        if member_id:
            transformations = get_transformations_by_member(
                member_id,
            )
        else:
            transformations = get_all_transformations()

        return Response(
            [
                serialize_transformation(
                    transformation
                )
                for transformation in transformations
            ],
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "create a transformation record."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TransformationSerializer(
            data=request.data,
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        member_id = serializer.validated_data[
            "member_id"
        ]

        week_number = serializer.validated_data[
            "week_number"
        ]

        existing = get_transformation_by_member_and_week(
            member_id,
            week_number,
        )

        if existing is not None:
            return Response(
                {
                    "detail": (
                        "Transformation record already "
                        "exists for this member and week."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        transformation = create_transformation(
            serializer.validated_data,
        )

        return Response(
            serialize_transformation(
                transformation
            ),
            status=status.HTTP_201_CREATED,
        )


class TransformationMemberListView(APIView):

    permission_classes = [MemberScopedAccess]

    def get(self, request, member_id):
        transformations = get_transformations_by_member(
            member_id,
        )

        return Response(
            [
                serialize_transformation(
                    transformation
                )
                for transformation in transformations
            ],
            status=status.HTTP_200_OK,
        )


class TransformationDetailView(APIView):

    permission_classes = [IsStaffUser]

    def get(self, request, transformation_id):
        transformation = get_transformation_by_id(
            transformation_id,
        )

        if transformation is None:
            return Response(
                {
                    "detail": "Transformation not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_transformation(
                transformation
            ),
            status=status.HTTP_200_OK,
        )

    def put(self, request, transformation_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "update a transformation record."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return self._update(
            request,
            transformation_id,
            partial=False,
        )

    def patch(self, request, transformation_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "update a transformation record."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return self._update(
            request,
            transformation_id,
            partial=True,
        )

    def _update(
        self,
        request,
        transformation_id,
        partial,
    ):
        existing = get_transformation_by_id(
            transformation_id,
        )

        if existing is None:
            return Response(
                {
                    "detail": "Transformation not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TransformationSerializer(
            data=request.data,
            partial=partial,
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        member_id = serializer.validated_data.get(
            "member_id",
            existing["member_id"],
        )

        week_number = serializer.validated_data.get(
            "week_number",
            existing["week_number"],
        )

        duplicate = get_transformation_by_member_and_week(
            member_id,
            week_number,
        )

        if (
            duplicate is not None
            and str(duplicate["_id"])
            != str(existing["_id"])
        ):
            return Response(
                {
                    "detail": (
                        "Transformation record already "
                        "exists for this member and week."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        transformation = update_transformation(
            transformation_id,
            serializer.validated_data,
        )

        if transformation is None:
            return Response(
                {
                    "detail": "Transformation not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_transformation(
                transformation
            ),
            status=status.HTTP_200_OK,
        )

    def delete(self, request, transformation_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "delete a transformation record."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        deleted = delete_transformation(
            transformation_id,
        )

        if not deleted:
            return Response(
                {
                    "detail": "Transformation not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )