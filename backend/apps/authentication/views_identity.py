from rest_framework.response import Response
from rest_framework.views import APIView

from apps.members.repository import get_member_by_id

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

        member = get_member_by_id(member_id)

        return Response(
            {
                "username": request.user.username,
                "member_id": member_id,
                "role": role,
                "password_reset_required": bool(
                    member
                    and member.get(
                        "password_reset_required"
                    )
                ),
            }
        )