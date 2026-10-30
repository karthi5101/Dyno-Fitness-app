from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.members.repository import get_member_by_id

from .identity import get_member_id_for_user
from .serializers import LoginSerializer


class LoginView(APIView):
    """
    Authenticate a Django user and issue JWT tokens
    together with the linked Dyno member identity
    and account role.
    """

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        user = serializer.validated_data["user"]

        member_id = get_member_id_for_user(user)

        if member_id is None:
            return Response(
                {
                    "detail": (
                        "This account is not linked "
                        "to a Dyno member."
                    ),
                },
                status=400,
            )

        refresh = RefreshToken.for_user(user)

        role = (
            "staff"
            if user.is_staff
            else "member"
        )

        member = get_member_by_id(member_id)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "username": user.username,
                    "member_id": member_id,
                    "role": role,
                    "password_reset_required": bool(
                        member
                        and member.get(
                            "password_reset_required"
                        )
                    ),
                },
            }
        )
