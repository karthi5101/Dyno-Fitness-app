"""Member status transition tests for the isolated test DB."""

import os
import unittest
from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.authentication.models import UserMemberProfile
from apps.members.database import get_members_collection
from apps.members.repository import generate_member_id

TEST_PREFIX = "TEST-MEMBER-STATUS-"
TEST_MEMBER = TEST_PREFIX + "MEMBER"
TEST_STAFF = TEST_PREFIX + "STAFF"
STRONG_PASSWORD = "DynoStrong!2026"

User = get_user_model()


def ensure_test_database():
    if os.getenv("MONGODB_DATABASE") != "dyno_fitness_test":
        raise unittest.SkipTest(
            "Set MONGODB_DATABASE=dyno_fitness_test to run member tests."
        )


class MemberStatusTests(TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_test_database()
        super().setUpClass()

        get_members_collection().delete_many(
            {"member_id": TEST_MEMBER}
        )
        get_members_collection().insert_one(
            {
                "member_id": TEST_MEMBER,
                "name": "Status Test Member",
                "phone": "9000000000",
                "joining_date": "2026-01-01",
                "status": "active",
            }
        )

    @classmethod
    def tearDownClass(cls):
        UserMemberProfile.objects.filter(
            member_id=TEST_MEMBER
        ).delete()
        User.objects.filter(
            username__startswith=TEST_PREFIX
        ).delete()
        get_members_collection().delete_many(
            {"member_id": TEST_MEMBER}
        )

        super().tearDownClass()

    def setUp(self):
        self.staff = User.objects.create_user(
            username=TEST_STAFF,
            password=STRONG_PASSWORD,
            is_staff=True,
        )
        self.user = User.objects.create_user(
            username=TEST_MEMBER,
            password=STRONG_PASSWORD,
            is_active=True,
        )
        UserMemberProfile.objects.create(
            user=self.user,
            member_id=TEST_MEMBER,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

        get_members_collection().update_one(
            {"member_id": TEST_MEMBER},
            {
                "$set": {
                    "status": "active",
                    "password_reset_required": False,
                }
            },
        )
        self.user.set_password(STRONG_PASSWORD)
        self.user.is_active = True
        self.user.save(update_fields=["password", "is_active"])

    def test_deactivation_preserves_member_and_login(self):
        response = self.client.put(
            f"/api/members/{TEST_MEMBER}/",
            {"status": "inactive"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "inactive")

        member = get_members_collection().find_one(
            {"member_id": TEST_MEMBER}
        )
        self.assertIsNotNone(member)
        self.assertEqual(member["status"], "inactive")

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

        fetched = self.client.get(
            f"/api/members/{TEST_MEMBER}/"
        )
        self.assertEqual(fetched.status_code, 200)

    def test_new_member_id_is_generated_and_used_as_password(self):
        response = self.client.post(
            "/api/members/",
            {
                "name": "Generated Member",
                "phone": "9222222222",
                "joining_date": date.today().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        member_id = response.data["member_id"]
        self.assertRegex(member_id, r"^A\d{3,}$")

        self.addCleanup(
            get_members_collection().delete_many,
            {"member_id": member_id},
        )
        self.addCleanup(
            UserMemberProfile.objects.filter(
                member_id=member_id
            ).delete
        )
        self.addCleanup(
            User.objects.filter(
                username=member_id
            ).delete
        )

        member = get_members_collection().find_one(
            {"member_id": member_id}
        )
        self.assertIsNotNone(member)
        self.assertTrue(member["password_reset_required"])

        user = User.objects.get(username=member_id)
        self.assertTrue(user.check_password(member_id))
        self.assertTrue(user.is_active)

    def test_generated_member_ids_are_unique_under_concurrency(self):
        from concurrent.futures import ThreadPoolExecutor

        with ThreadPoolExecutor(max_workers=8) as pool:
            member_ids = list(
                pool.map(
                    lambda _index: generate_member_id(),
                    range(8),
                )
            )

        self.assertEqual(len(member_ids), 8)
        self.assertEqual(len(set(member_ids)), 8)

        for member_id in member_ids:
            self.assertRegex(member_id, r"^A\d{3,}$")
