from rest_framework.response import Response
from rest_framework.views import APIView

from .identity import get_member_id_for_user
from .permissions import HasLinkedMember


class CurrentIdentityView(APIView):
    """
    Return the authenticated Django user's
    Dyno member identity and account role.
    """

    permission_classes = [HasLinkedMember]

    def get(self, request):
        member_id = get_member_id_for_user(
            request.user,
        )

        role = (
            "staff"
            if request.user.is_staff
            else "member"
        )

        return Response(
            {
                "username": request.user.username,
                "member_id": member_id,
                "role": role,
            }
        )