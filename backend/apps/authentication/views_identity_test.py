from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .identity import get_member_id_for_user


class AuthenticatedMemberIdentityView(APIView):
    """
    Return the Dyno member identity derived exclusively
    from the authenticated Django user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        member_id = get_member_id_for_user(
            request.user,
        )

        if member_id is None:
            return Response(
                {
                    "detail": (
                        "Authenticated user is not linked "
                        "to a Dyno member."
                    ),
                },
                status=403,
            )

        return Response(
            {
                "authenticated": True,
                "username": request.user.username,
                "member_id": member_id,
            }
        )