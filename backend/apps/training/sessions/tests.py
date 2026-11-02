import os

import unittest
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.database.mongodb import MongoDB


TEST_PREFIX = "TRAIN-SESSION-"


def ensure_test_database():
    if os.getenv("MONGODB_DATABASE") != "dyno_fitness_test":
        raise unittest.SkipTest(
            "Set MONGODB_DATABASE=dyno_fitness_test to run "
            "training sessions tests."
        )


def make_staff_client():
    client = APIClient()
    User = get_user_model()
    user, _ = User.objects.get_or_create(
        username="staff_test", defaults={"is_staff": True, "is_superuser": True}
    )
    client.force_authenticate(user=user)
    return client


def make_member_client():
    """Create a client force-authenticated to a linked member user."""
    client = APIClient()
    User = get_user_model()
    user, _ = User.objects.get_or_create(
        username="member_test", defaults={"is_staff": False}
    )
    from apps.authentication.models import UserMemberProfile
    from apps.members.repository import generate_member_id

    profile, _ = UserMemberProfile.objects.get_or_create(
        user=user,
        defaults={"member_id": generate_member_id(), "status": "active"},
    )
    client.force_authenticate(user=user)
    return client, str(profile.member_id)


def make_nonstaff_client():
    client = APIClient()
    User = get_user_model()
    user, _ = User.objects.get_or_create(
        username="nonstaff_test", defaults={"is_staff": False, "is_superuser": False}
    )
    client.force_authenticate(user=user)
    return client