from pathlib import Path

from django.conf import settings
from django.http import FileResponse
from django.urls import reverse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.authentication.permissions import IsStaffOrReadOnly
from apps.training.flag import TrainingEnabledAPIView

from .repositories import (
    create_custom_exercise,
    get_exercise_by_id,
    list_exercises,
    update_custom_exercise,
)
from .serializers import (
    ExerciseCreateSerializer,
    ExerciseUpdateSerializer,
)
from .utils import is_valid_slug


def serialize_datetime(value):
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def serialize_exercise(document, request=None):
    slug = document.get("slug", "")
    images = []

    for index, _ in enumerate(document.get("images", [])):
        path = reverse(
            "training-exercise-media",
            kwargs={
                "slug": slug,
                "n": index,
            },
        )

        images.append(
            request.build_absolute_uri(path)
            if request is not None
            else path
        )

    favorite_by = document.get("favorite_by", [])
    username = (
        request.user.username
        if request is not None
        and request.user.is_authenticated
        else None
    )

    return {
        "id": str(document["_id"]),
        "slug": slug,
        "name": document.get("name", ""),
        "primary_muscles": document.get("primary_muscles", []),
        "secondary_muscles": document.get(
            "secondary_muscles",
            [],
        ),
        "equipment": document.get("equipment", ""),
        "level": document.get("level", ""),
        "category": document.get("category", ""),
        "instructions": document.get("instructions", []),
        "images": images,
        "image_url": images[0] if images else None,
        "tracking_type": document.get(
            "tracking_type",
            "weight_reps",
        ),
        "is_custom": bool(document.get("is_custom")),
        "is_favorite": bool(
            username and username in favorite_by
        ),
        "archived": bool(document.get("archived")),
        "created_by": document.get("created_by"),
        "created_at": serialize_datetime(
            document.get("created_at")
        ),
        "updated_at": serialize_datetime(
            document.get("updated_at")
        ),
    }


class ExerciseListCreateView(TrainingEnabledAPIView):
    permission_classes = [IsStaffOrReadOnly]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", 20))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Limit must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if limit < 1 or limit > 50:
            return Response(
                {"detail": "Limit must be between 1 and 50."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        favorite = request.query_params.get("favorite")

        if favorite not in (None, "", "true", "false"):
            return Response(
                {"detail": "Favorite must be true or false."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filters = {
            "q": request.query_params.get("q", ""),
            "muscle": request.query_params.get("muscle", ""),
            "equipment": request.query_params.get(
                "equipment",
                "",
            ),
            "level": request.query_params.get("level", ""),
            "category": request.query_params.get(
                "category",
                "",
            ),
        }

        if favorite == "true":
            filters["favorite_by"] = request.user.username

        try:
            documents, next_cursor = list_exercises(
                filters=filters,
                limit=limit,
                cursor=request.query_params.get("cursor"),
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "results": [
                    serialize_exercise(document, request)
                    for document in documents
                ],
                "next_cursor": next_cursor,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = ExerciseCreateSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            document = create_custom_exercise(
                serializer.validated_data,
                created_by=request.user.username,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            serialize_exercise(document, request),
            status=status.HTTP_201_CREATED,
        )


class ExerciseDetailView(TrainingEnabledAPIView):
    permission_classes = [IsStaffOrReadOnly]

    def get(self, request, exercise_id):
        document = get_exercise_by_id(exercise_id)

        if document is None:
            return Response(
                {"detail": "Exercise not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_exercise(document, request),
            status=status.HTTP_200_OK,
        )

    def patch(self, request, exercise_id):
        document = get_exercise_by_id(exercise_id)

        if document is None:
            return Response(
                {"detail": "Exercise not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not document.get("is_custom"):
            return Response(
                {
                    "detail": (
                        "System exercises are read-only."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ExerciseUpdateSerializer(
            data=request.data,
            partial=True,
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            document = update_custom_exercise(
                exercise_id,
                serializer.validated_data,
            )
        except PermissionError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_403_FORBIDDEN,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if document is None:
            return Response(
                {"detail": "Exercise not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_exercise(document, request),
            status=status.HTTP_200_OK,
        )


class ExerciseMediaView(TrainingEnabledAPIView):
    permission_classes = [AllowAny]

    def get(self, request, slug, n):
        if not is_valid_slug(slug):
            return Response(
                {"detail": "Invalid exercise slug."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if n < 0 or n > 9:
            return Response(
                {"detail": "Exercise image not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        media_root = (
            Path(settings.BASE_DIR)
            / "apps"
            / "training"
            / "media"
            / "exercises"
        )
        image_path = media_root / slug / f"{n}.jpg"

        try:
            resolved_root = media_root.resolve()
            resolved_image = image_path.resolve()
            resolved_image.relative_to(resolved_root)
        except (OSError, ValueError):
            return Response(
                {"detail": "Invalid exercise media path."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not resolved_image.is_file():
            return Response(
                {"detail": "Exercise image not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        response = FileResponse(
            open(resolved_image, "rb"),
            content_type="image/jpeg",
        )
        response["Cache-Control"] = (
            "public, max-age=86400, immutable"
        )
        response["X-Content-Type-Options"] = "nosniff"

        return response
