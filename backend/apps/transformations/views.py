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
    update_transformation_image,
)
from apps.transformations.serializers import (
    TransformationSerializer,
)
from apps.uploads import (
    IMAGE_CONTENT_TYPES,
    delete_upload,
    save_upload,
    signed_url_from_document,
)


def serialize_datetime(value):
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def serialize_transformation(document, request=None):
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

        "front_image_url": signed_url_from_document(
            document,
            "front_image",
            request,
        ),

        "back_image_url": signed_url_from_document(
            document,
            "back_image",
            request,
        ),

        # -------------------------------------------------
        # Backward compatibility with the original
        # single-image transformation workflow.
        # -------------------------------------------------

        "image_url": signed_url_from_document(
            document,
            "image",
            request,
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
                    transformation,
                    request,
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
                transformation,
                request,
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
                    transformation,
                    request,
                )
                for transformation in transformations
            ],
            status=status.HTTP_200_OK,
        )


class TransformationImageUploadView(APIView):
    permission_classes = [IsStaffUser]

    _PREFIXES = {
        "image": "image",
        "front": "front_image",
        "back": "back_image",
    }

    def post(self, request, transformation_id):
        transformation = get_transformation_by_id(
            transformation_id,
        )

        if transformation is None:
            return Response(
                {"detail": "Transformation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        slot = str(request.data.get("slot", "image")).strip()

        if slot not in self._PREFIXES:
            return Response(
                {"slot": ["Use image, front, or back."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            upload_metadata = save_upload(
                request.FILES.get("file"),
                allowed_content_types=IMAGE_CONTENT_TYPES,
                purpose=f"transformation_{slot}",
            )
        except ValueError as exc:
            return Response(
                {"file": [str(exc)]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prefix = self._PREFIXES[slot]
        old_file_id = transformation.get(f"{prefix}_file_id")

        updated = update_transformation_image(
            transformation_id,
            prefix,
            upload_metadata,
        )

        if updated is None:
            delete_upload(upload_metadata["file_id"])

            return Response(
                {"detail": "Transformation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if old_file_id and old_file_id != upload_metadata["file_id"]:
            delete_upload(old_file_id)

        return Response(
            serialize_transformation(updated, request),
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
                transformation,
                request,
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
                transformation,
                request,
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