from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsStaffUser
from apps.inactive_members.repository import (
    get_inactive_member_candidates,
)
from apps.inactive_members.serializers import (
    InactiveMemberSerializer,
)


class InactiveMemberListView(APIView):

    permission_classes = [IsStaffUser]

    def get(self, request):
        candidates = get_inactive_member_candidates()

        serializer = InactiveMemberSerializer(
            candidates,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )