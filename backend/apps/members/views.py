from .database import get_members_collection
from apps.authentication.models import UserMemberProfile

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction

from pymongo.errors import DuplicateKeyError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import UserMemberProfile
from apps.authentication.permissions import (
    IsStaffOrReadOnly,
    IsStaffUser,
    MemberScopedAccess,
)

from .repository import (
    create_member,
    get_all_members,
    get_member_by_id,
    update_member,
)
from .serializers import (
    MemberSerializer,
    MemberUpdateSerializer,
)


User = get_user_model()


def serialize_member(member):
    return {
        "member_id": member["member_id"],
        "name": member["name"],
        "phone": member["phone"],
        "email": member.get("email", ""),
        "date_of_birth": member.get("date_of_birth"),
        "gender": member.get("gender"),
        "joining_date": member["joining_date"],
        "status": member["status"],
        "emergency_contact": member.get("emergency_contact", ""),
        "preferred_session": member.get("preferred_session"),
    }


def sync_member_account_status(member_id, status):
    """
    Synchronize a linked non-staff account with the
    member's active/inactive status.

    Staff accounts are not disabled through member status.
    """
    profile = UserMemberProfile.objects.filter(
        member_id=member_id,
    ).select_related("user").first()

    if profile is None:
        return

    user = profile.user

    if user.is_staff:
        return

    desired_active_state = status == "active"

    if user.is_active != desired_active_state:
        user.is_active = desired_active_state
        user.save(update_fields=["is_active"])


class MemberListView(APIView):
    """List all members and register a new member."""

    permission_classes = [IsStaffUser]

    def get(self, request):
        members = get_all_members()

        return Response([
            serialize_member(member)
            for member in members
        ])

    def post(self, request):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "register a member."
                    )
                },
                status=403,
            )

        serializer = MemberSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = dict(serializer.validated_data)
        password = data.pop("password")
        data.pop("status", None)

        member_id = data["member_id"]

        # Never create a second record for an existing member.
        if get_member_by_id(member_id) is not None:
            return Response(
                {"detail": "A member with this member_id already exists."},
                status=409,
            )

        # Member ID becomes the new member's Django username.
        if User.objects.filter(username=member_id).exists():
            return Response(
                {
                    "detail": (
                        "This member ID conflicts with an existing "
                        "Django username. Resolve the account conflict "
                        "before registering this member."
                    )
                },
                status=409,
            )

        if UserMemberProfile.objects.filter(
            member_id=member_id,
        ).exists():
            return Response(
                {"detail": "This member ID is already linked to an account."},
                status=409,
            )

        password_user = User(
            username=member_id,
            first_name=data["name"],
            email=data.get("email") or "",
        )

        try:
            validate_password(password, user=password_user)
        except DjangoValidationError as exc:
            return Response(
                {"password": list(exc.messages)},
                status=400,
            )

        # Force active status regardless of any supplied status.
        data["status"] = "active"

        try:
            # Django user/profile changes are rolled back together
            # if registration fails. MongoDB is not part of this
            # transaction, so MongoDB errors are allowed to escape
            # the atomic block and trigger SQL rollback.
            with transaction.atomic():
                user = User.objects.create_user(
                    username=member_id,
                    password=password,
                    email=data.get("email") or "",
                    first_name=data["name"],
                    is_active=True,
                )

                UserMemberProfile.objects.create(
                    user=user,
                    member_id=member_id,
                )

                member = create_member(data)

        except DuplicateKeyError:
            return Response(
                {
                    "detail": (
                        "A member with this member_id already exists."
                    )
                },
                status=409,
            )

        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "An account or member profile already exists "
                        "for this member ID."
                    )
                },
                status=409,
            )

        return Response(serialize_member(member), status=201)


class MemberDetailView(APIView):
    """Retrieve, update, or deactivate a member."""

    permission_classes = [MemberScopedAccess]

    def get(self, request, member_id):
        member = get_member_by_id(member_id)

        if member is None:
            return Response(
                {"detail": "Member not found."},
                status=404,
            )

        return Response(serialize_member(member))

    def put(self, request, member_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "update a member."
                    )
                },
                status=403,
            )

        member = get_member_by_id(member_id)

        if member is None:
            return Response(
                {"detail": "Member not found."},
                status=404,
            )

        serializer = MemberUpdateSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        update_data = serializer.validated_data

        try:
            updated_member = update_member(member_id, update_data)
        except DuplicateKeyError:
            return Response(
                {"detail": "Unable to update member."},
                status=409,
            )

        if updated_member is None:
            return Response(
                {"detail": "Member not found."},
                status=404,
            )

        if "status" in update_data:
            sync_member_account_status(
                member_id,
                updated_member["status"],
            )

        return Response(serialize_member(updated_member))

    
    def delete(self, request, member_id):
        # Permanent profile deletion is staff-only.
        if not request.user.is_authenticated or not request.user.is_staff:
            return Response(
                {"detail": "Staff permission is required to delete a member."},
                status=403,
            )

        member = get_member_by_id(member_id)
        if member is None:
            return Response(
                {"detail": "Member not found."},
                status=404,
            )

        # Never allow this endpoint to delete a staff login.
        profile = UserMemberProfile.objects.select_related("user").filter(
            member_id=member_id
        ).first()

        if profile and profile.user.is_staff:
            return Response(
                {"detail": "A staff account cannot be deleted through member management."},
                status=403,
            )

        # Remove the MongoDB member profile.
        get_members_collection().delete_one({"member_id": member_id})

        # Remove the linked Django profile and login account.
        if profile:
            profile.user.delete()

        return Response(
            {
                "detail": "Member profile and linked login account deleted.",
                "member_id": member_id,
            },
            status=200,
        )
