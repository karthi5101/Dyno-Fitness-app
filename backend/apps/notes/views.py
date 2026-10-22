from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsStaffUser

from .repositories import (
    create_note,
    delete_note,
    get_note_by_id,
    get_notes_by_member,
    member_exists,
    update_note,
)
from .serializers import (
    NoteSerializer,
    NoteUpdateSerializer,
)


def serialize_note(document):
    if not document:
        return None

    return {
        "id": str(document["_id"]),
        "member_id": document["member_id"],
        "title": document.get("title", ""),
        "body": document.get("body", ""),
        "created_by": document.get("created_by", ""),
        "created_at": (
            document["created_at"].isoformat()
            if hasattr(document.get("created_at"), "isoformat")
            else document.get("created_at")
        ),
        "updated_at": (
            document["updated_at"].isoformat()
            if hasattr(document.get("updated_at"), "isoformat")
            else document.get("updated_at")
        ),
    }


class NoteMemberListView(APIView):
    """
    List every staff note recorded for one member.

    Staff only. Notes are internal records and are never
    exposed to member accounts.
    """

    permission_classes = [IsStaffUser]

    def get(self, request, member_id):
        if not member_exists(member_id):
            return Response(
                {"detail": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        notes = get_notes_by_member(member_id)

        return Response(
            [
                serialize_note(note)
                for note in notes
            ],
            status=status.HTTP_200_OK,
        )


class NoteListCreateView(APIView):
    """
    Create a staff note for a member.
    """

    permission_classes = [IsStaffUser]

    def post(self, request):
        serializer = NoteSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        member_id = serializer.validated_data["member_id"]

        if not member_exists(member_id):
            return Response(
                {"detail": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        note = create_note(
            serializer.validated_data,
            created_by=request.user.username,
        )

        return Response(
            serialize_note(note),
            status=status.HTTP_201_CREATED,
        )


class NoteDetailView(APIView):
    """
    Update or delete a single staff note.
    """

    permission_classes = [IsStaffUser]

    def put(self, request, note_id):
        return self._update(request, note_id)

    def patch(self, request, note_id):
        return self._update(request, note_id)

    def _update(self, request, note_id):
        existing = get_note_by_id(note_id)

        if existing is None:
            return Response(
                {"detail": "Note not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = NoteUpdateSerializer(
            data=request.data,
            partial=True,
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        note = update_note(
            note_id,
            serializer.validated_data,
        )

        if note is None:
            return Response(
                {"detail": "Note not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_note(note),
            status=status.HTTP_200_OK,
        )

    def delete(self, request, note_id):
        if not delete_note(note_id):
            return Response(
                {"detail": "Note not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )
