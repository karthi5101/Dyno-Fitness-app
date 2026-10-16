from rest_framework.permissions import BasePermission

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