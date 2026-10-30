import logging
import secrets
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail

from pymongo import ReturnDocument
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.identity import get_member_id_for_user
from apps.authentication.models import UserMemberProfile
from apps.members.database import get_members_collection
from apps.members.repository import get_member_by_id

logger = logging.getLogger(__name__)
User = get_user_model()

RESET_TTL_SECONDS = 600
RESET_MAX_ATTEMPTS = 5

RECOVERY_WINDOW_DAYS = 15
RECOVERY_FAILURE_WINDOW_MINUTES = 15
RECOVERY_FAILURE_LIMIT = 5
RECOVERY_LOCK_SECONDS = 30
RECOVERY_IP_LIMIT = 20
RECOVERY_IP_WINDOW_SECONDS = 900

RECOVERY_GENERIC_ERROR = (
    "Unable to verify these recovery details."
)
RECOVERY_BUSY_ERROR = (
    "Too many recovery attempts. Try again later."
)

DUMMY_ANSWER_HASH = make_password("dyno-recovery-placeholder")


def normalize_school_answer(value):
    return " ".join(
        str(value or "").strip().split()
    ).casefold()


def _as_naive_utc(value):
    if not isinstance(value, datetime):
        return None

    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(
            tzinfo=None
        )

    return value


def _recent_events(events, event_type, cutoff):
    recent = []

    for event in events or []:
        if not isinstance(event, dict):
            continue

        if event.get("type") != event_type:
            continue

        event_at = _as_naive_utc(event.get("at"))

        if event_at is not None and event_at >= cutoff:
            recent.append(event)

    return recent


def _client_ip(request):
    forwarded = request.META.get(
        "HTTP_X_FORWARDED_FOR",
        "",
    )

    if forwarded:
        return forwarded.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR", "")


def _clear_recovery_lock(member_id):
    get_members_collection().update_one(
        {"member_id": member_id},
        {"$unset": {"recovery_lock_until": ""}},
    )


def _record_failed_recovery(member_id, now, ip):
    get_members_collection().update_one(
        {"member_id": member_id},
        {
            "$push": {
                "recovery_events": {
                    "$each": [
                        {
                            "type": "failed",
                            "at": now,
                            "ip": ip,
                        }
                    ],
                    "$slice": -50,
                }
            },
            "$unset": {"recovery_lock_until": ""},
        },
    )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get("old_password", "")
        new_password = request.data.get("new_password", "")
        school_answer = request.data.get("school_answer", "")

        if not isinstance(old_password, str) or not isinstance(
            new_password,
            str,
        ):
            return Response(
                {"detail": "Both passwords must be strings."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(old_password):
            return Response(
                {"old_password": ["Current password is incorrect."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member_id = get_member_id_for_user(request.user)
        member = get_member_by_id(member_id) if member_id else None

        if member_id and member is None:
            return Response(
                {"detail": "Member profile not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if member_id and (
            not isinstance(school_answer, str)
            or not normalize_school_answer(school_answer)
        ):
            return Response(
                {
                    "school_answer": [
                        "Answer the school security question."
                    ]
                },
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

        if member_id:
            normalized_answer = normalize_school_answer(
                school_answer
            )

            get_members_collection().update_one(
                {"member_id": member_id},
                {
                    "$set": {
                        "security_answer_hash": make_password(
                            normalized_answer
                        ),
                        "password_reset_required": False,
                        "updated_at": datetime.utcnow(),
                    },
                    "$unset": {
                        "recovery_lock_until": "",
                    },
                },
            )

        return Response(
            {"detail": "Password and security answer updated."}
        )


class SchoolPasswordRecoveryView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        member_id = str(
            request.data.get("member_id", "")
        ).strip()
        school_answer = request.data.get(
            "school_answer",
            "",
        )
        new_password = request.data.get("new_password", "")
        ip = _client_ip(request)
        now = datetime.utcnow()

        ip_key = f"dyno_recovery_ip:{ip}"
        ip_attempts = cache.get(ip_key, 0)

        if ip_attempts >= RECOVERY_IP_LIMIT:
            return Response(
                {"detail": RECOVERY_BUSY_ERROR},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if (
            not member_id
            or not isinstance(school_answer, str)
            or not isinstance(new_password, str)
        ):
            return Response(
                {"detail": RECOVERY_GENERIC_ERROR},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = get_member_by_id(member_id)
        profile = UserMemberProfile.objects.select_related(
            "user"
        ).filter(member_id=member_id).first()

        if (
            member is None
            or profile is None
            or member.get("status") != "active"
            or not profile.user.is_active
        ):
            check_password(
                normalize_school_answer(school_answer),
                DUMMY_ANSWER_HASH,
            )
            cache.set(
                ip_key,
                ip_attempts + 1,
                timeout=RECOVERY_IP_WINDOW_SECONDS,
            )
            logger.info(
                "Password recovery failed for unknown or inactive member %s",
                member_id or "<empty>",
            )
            return Response(
                {"detail": RECOVERY_GENERIC_ERROR},
                status=status.HTTP_400_BAD_REQUEST,
            )

        locked_member = get_members_collection().find_one_and_update(
            {
                "member_id": member_id,
                "$or": [
                    {"recovery_lock_until": {"$exists": False}},
                    {"recovery_lock_until": {"$lte": now}},
                ],
            },
            {
                "$set": {
                    "recovery_lock_until": now
                    + timedelta(
                        seconds=RECOVERY_LOCK_SECONDS
                    ),
                }
            },
            return_document=ReturnDocument.AFTER,
        )

        if locked_member is None:
            return Response(
                {"detail": RECOVERY_BUSY_ERROR},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        events = locked_member.get("recovery_events", [])
        failure_cutoff = now - timedelta(
            minutes=RECOVERY_FAILURE_WINDOW_MINUTES
        )
        recent_failures = _recent_events(
            events,
            "failed",
            failure_cutoff,
        )

        if len(recent_failures) >= RECOVERY_FAILURE_LIMIT:
            _clear_recovery_lock(member_id)
            cache.set(
                ip_key,
                ip_attempts + 1,
                timeout=RECOVERY_IP_WINDOW_SECONDS,
            )
            logger.info(
                "Password recovery rate-limited for member %s",
                member_id,
            )
            return Response(
                {"detail": RECOVERY_BUSY_ERROR},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        answer_hash = locked_member.get(
            "security_answer_hash"
        )

        if not answer_hash:
            _clear_recovery_lock(member_id)
            logger.info(
                "Password recovery missing security answer for member %s",
                member_id,
            )
            return Response(
                {"detail": RECOVERY_GENERIC_ERROR},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not check_password(
            normalize_school_answer(school_answer),
            answer_hash,
        ):
            _record_failed_recovery(member_id, now, ip)
            cache.set(
                ip_key,
                ip_attempts + 1,
                timeout=RECOVERY_IP_WINDOW_SECONDS,
            )
            logger.info(
                "Password recovery incorrect answer for member %s",
                member_id,
            )
            return Response(
                {"detail": RECOVERY_GENERIC_ERROR},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(
                new_password,
                user=profile.user,
            )
        except DjangoValidationError as exc:
            _clear_recovery_lock(member_id)
            return Response(
                {"new_password": exc.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.user.set_password(new_password)
        profile.user.save(update_fields=["password"])

        success_cutoff = now - timedelta(
            days=RECOVERY_WINDOW_DAYS
        )
        recent_successes = _recent_events(
            events,
            "success",
            success_cutoff,
        )
        deactivated = len(recent_successes) + 1 >= 2

        update = {
            "$push": {
                "recovery_events": {
                    "$each": [
                        {
                            "type": "success",
                            "at": now,
                            "ip": ip,
                        }
                    ],
                    "$slice": -50,
                }
            },
            "$set": {
                "password_reset_required": True,
                "updated_at": now,
            },
            "$unset": {
                "recovery_lock_until": "",
            },
        }

        if deactivated:
            update["$set"].update(
                {
                    "status": "inactive",
                    "deactivation_reason": "recovery_abuse",
                    "deactivated_at": now,
                }
            )
            profile.user.is_active = False
            profile.user.save(update_fields=["is_active"])

        get_members_collection().update_one(
            {"member_id": member_id},
            update,
        )

        logger.info(
            "Password recovery succeeded for member %s; deactivated=%s",
            member_id,
            deactivated,
        )

        if deactivated:
            return Response(
                {
                    "detail": (
                        "Password reset, but this account now "
                        "requires staff reactivation."
                    ),
                    "deactivated": True,
                }
            )

        return Response(
            {"detail": "Password reset successfully."}
        )


class PasswordResetRequestView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        if not getattr(
            settings,
            "EMAIL_PASSWORD_RESET_ENABLED",
            False,
        ):
            return Response(
                {
                    "detail": (
                        "Email password recovery is not enabled."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

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
        if not getattr(
            settings,
            "EMAIL_PASSWORD_RESET_ENABLED",
            False,
        ):
            return Response(
                {
                    "detail": (
                        "Email password recovery is not enabled."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

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
