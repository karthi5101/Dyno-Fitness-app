from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

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

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "username": user.username,
                    "member_id": member_id,
                    "role": role,
                },
            }
        )


class CurrentIdentityView(APIView):
    """
    Return the currently authenticated user's
    Dyno identity and account role.
    """

    def get(self, request):
        member_id = get_member_id_for_user(
            request.user
        )

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