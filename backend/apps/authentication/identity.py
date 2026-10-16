from apps.authentication.models import UserMemberProfile


def get_member_id_for_user(user):
    """
    Return the Dyno MongoDB member_id linked to
    the authenticated Django user.

    Returns None when no member profile exists.
    """

    if user is None or not user.is_authenticated:
        return None

    try:
        profile = UserMemberProfile.objects.get(
            user=user,
        )
    except UserMemberProfile.DoesNotExist:
        return None

    return profile.member_id