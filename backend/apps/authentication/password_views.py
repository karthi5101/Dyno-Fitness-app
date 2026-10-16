
import logging
import secrets

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.mail import send_mail
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import UserMemberProfile
from apps.members.repository import get_member_by_id

logger = logging.getLogger(__name__)
User = get_user_model()

RESET_TTL_SECONDS = 600
RESET_MAX_ATTEMPTS = 5


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get("old_password", "")
        new_password = request.data.get("new_password", "")

        if not isinstance(old_password, str) or not isinstance(new_password, str):
            return Response(
                {"detail": "Both passwords must be strings."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(old_password):
            return Response(
                {"old_password": ["Current password is incorrect."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as exc:
            return Response(
                {"new_password": exc.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])

        return Response({"detail": "Password changed successfully."})


class PasswordResetRequestView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        member_id = str(request.data.get("member_id", "")).strip()
        generic_response = {
            "detail": (
                "If this account has a registered email address, "
                "a verification code will be sent."
            )
        }

        if not member_id:
            return Response(generic_response, status=status.HTTP_200_OK)

        member = get_member_by_id(member_id)
        profile = UserMemberProfile.objects.select_related("user").filter(
            member_id=member_id
        ).first()

        if not member or not profile or not profile.user.is_active:
            return Response(generic_response, status=status.HTTP_200_OK)

        email = (member.get("email") or profile.user.email or "").strip()
        if not email:
            return Response(generic_response, status=status.HTTP_200_OK)

        code = f"{secrets.randbelow(1_000_000):06d}"
        cache.set(
            f"dyno_pw_reset:{member_id}",
            make_password(code),
            timeout=RESET_TTL_SECONDS,
        )
        cache.set(f"dyno_pw_attempts:{member_id}", 0, timeout=RESET_TTL_SECONDS)

        try:
            send_mail(
                subject="Dyno Fitness password verification",
                message=(
                    f"Your Dyno Fitness verification code is {code}.\n\n"
                    "It expires in 10 minutes. If you did not request this, "
                    "you can ignore this email."
                ),
                from_email=None,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception:
            logger.exception("Could not send password reset email for member %s", member_id)
            cache.delete(f"dyno_pw_reset:{member_id}")
            cache.delete(f"dyno_pw_attempts:{member_id}")

        return Response(generic_response, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        member_id = str(request.data.get("member_id", "")).strip()
        code = str(request.data.get("verification_code", "")).strip()
        new_password = request.data.get("new_password", "")

        if not member_id or not code or not isinstance(new_password, str):
            return Response(
                {"detail": "Member ID, verification code, and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reset_key = f"dyno_pw_reset:{member_id}"
        attempts_key = f"dyno_pw_attempts:{member_id}"
        encoded_code = cache.get(reset_key)

        if not encoded_code:
            return Response(
                {"verification_code": ["The code is invalid or has expired. Request a new code."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attempts = cache.get(attempts_key, 0)
        if attempts >= RESET_MAX_ATTEMPTS:
            cache.delete(reset_key)
            cache.delete(attempts_key)
            return Response(
                {"verification_code": ["Too many attempts. Request a new code."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not check_password(code, encoded_code):
            cache.set(attempts_key, attempts + 1, timeout=RESET_TTL_SECONDS)
            return Response(
                {"verification_code": ["The verification code is incorrect."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = UserMemberProfile.objects.select_related("user").filter(
            member_id=member_id
        ).first()

        if profile is None or not profile.user.is_active:
            cache.delete(reset_key)
            cache.delete(attempts_key)
            return Response(
                {"detail": "This account cannot reset its password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=profile.user)
        except DjangoValidationError as exc:
            return Response(
                {"new_password": exc.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.user.set_password(new_password)
        profile.user.save(update_fields=["password"])

        cache.delete(reset_key)
        cache.delete(attempts_key)

        return Response({"detail": "Password reset successfully."})
