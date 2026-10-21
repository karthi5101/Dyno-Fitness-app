from rest_framework.permissions import (
    SAFE_METHODS,
    BasePermission,
)

from .identity import get_member_id_for_user


class HasLinkedMember(BasePermission):
    """
    Allow access only when the authenticated Django user
    is linked to a Dyno MongoDB member.
    """

    message = (
        "This account is not linked to a Dyno member."
    )

    def has_permission(self, request, view):
        return (
            get_member_id_for_user(request.user)
            is not None
        )


class IsStaffUser(BasePermission):
    """Allow access only to authenticated staff accounts."""

    message = "Staff access is required."

    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and user.is_staff
        )


class IsStaffOrReadOnly(BasePermission):
    """
    Staff accounts may use any method.

    Authenticated members are limited to safe
    (read-only) methods.
    """

    message = "Staff access is required to modify this resource."

    def has_permission(self, request, view):
        user = request.user

        if not (user and user.is_authenticated):
            return False

        if user.is_staff:
            return True

        return request.method in SAFE_METHODS


class MemberScopedAccess(BasePermission):
    """
    Staff accounts may access any member's records.

    Members may only read records belonging to
    their own linked member_id, derived from the
    authenticated account - never from the client.
    """

    message = "You are not allowed to access this member's records."

    def has_permission(self, request, view):
        user = request.user

        if not (user and user.is_authenticated):
            return False

        if user.is_staff:
            return True

        if request.method not in SAFE_METHODS:
            return False

        target_member_id = view.kwargs.get("member_id")

        if not target_member_id:
            return False

        return (
            str(get_member_id_for_user(user))
            == str(target_member_id)
        )