"""Authentication and school-question recovery tests.

These tests only run against the isolated MongoDB test database:

    MONGODB_DATABASE=dyno_fitness_test
"""

import os
import unittest
from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.authentication.models import UserMemberProfile
from apps.authentication.password_views import normalize_school_answer
from apps.members.database import get_members_collection

TEST_PREFIX = "TEST-AUTH-"
TEST_MEMBER = TEST_PREFIX + "MEMBER"
TEST_STAFF = TEST_PREFIX + "STAFF"
NEW_MEMBER = TEST_PREFIX + "NEW-MEMBER"
STRONG_PASSWORD = "DynoStrong!2026"
SECOND_PASSWORD = "DynoStrong!2027"
SCHOOL_ANSWER = "Green Valley High School"

User = get_user_model()


def ensure_test_database():
    if os.getenv("MONGODB_DATABASE") != "dyno_fitness_test":
        raise unittest.SkipTest(
            "Set MONGODB_DATABASE=dyno_fitness_test to run auth tests."
        )


class AuthenticationFlowTests(TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_test_database()
        super().setUpClass()

        cls.staff = User.objects.create_user(
            username=TEST_STAFF,
            password=STRONG_PASSWORD,
            is_staff=True,
        )

        cls.user = User.objects.create_user(
            username=TEST_MEMBER,
            password=TEST_MEMBER,
            is_active=True,
        )
        UserMemberProfile.objects.create(
            user=cls.user,
            member_id=TEST_MEMBER,
        )

        get_members_collection().delete_many(
            {"member_id": TEST_MEMBER}
        )
        get_members_collection().insert_one(
            {
                "member_id": TEST_MEMBER,
                "name": "Auth Test Member",
                "phone": "9000000000",
                "joining_date": "2026-01-01",
                "status": "active",
            }
        )

    @classmethod
    def tearDownClass(cls):
        UserMemberProfile.objects.filter(
            member_id__startswith=TEST_PREFIX
        ).delete()
        User.objects.filter(
            username__startswith=TEST_PREFIX
        ).delete()
        get_members_collection().delete_many(
            {"member_id": {"$regex": f"^{TEST_PREFIX}"}}
        )

        super().tearDownClass()

    def setUp(self):
        cache.clear()

        get_members_collection().update_one(
            {"member_id": TEST_MEMBER},
            {
                "$set": {
                    "status": "active",
                    "password_reset_required": True,
                    "security_answer_hash": make_password(
                        normalize_school_answer(SCHOOL_ANSWER)
                    ),
                },
                "$unset": {
                    "recovery_events": "",
                    "recovery_lock_until": "",
                },
            },
        )

        self.user.set_password(TEST_MEMBER)
        self.user.is_active = True
        self.user.save(update_fields=["password", "is_active"])

        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)

        self.member_client = APIClient()
        self.member_client.force_authenticate(user=self.user)

    def test_new_member_uses_member_id_as_default_password(self):
        User.objects.filter(username=NEW_MEMBER).delete()
        get_members_collection().delete_many(
            {"member_id": NEW_MEMBER}
        )

        response = self.staff_client.post(
            "/api/members/",
            {
                "member_id": NEW_MEMBER,
                "name": "New Auth Member",
                "phone": "9111111111",
                "joining_date": date.today().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        created_user = User.objects.get(username=NEW_MEMBER)
        self.assertTrue(
            created_user.check_password(NEW_MEMBER)
        )

        member = get_members_collection().find_one(
            {"member_id": NEW_MEMBER}
        )
        self.assertTrue(member["password_reset_required"])

    def test_change_password_requires_and_stores_school_answer(self):
        response = self.member_client.post(
            "/api/auth/password/change/",
            {
                "old_password": TEST_MEMBER,
                "new_password": STRONG_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("school_answer", response.data)

        response = self.member_client.post(
            "/api/auth/password/change/",
            {
                "old_password": TEST_MEMBER,
                "new_password": STRONG_PASSWORD,
                "school_answer": "  green   valley high school  ",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.assertTrue(
            self.user.check_password(STRONG_PASSWORD)
        )

        member = get_members_collection().find_one(
            {"member_id": TEST_MEMBER}
        )
        self.assertFalse(member["password_reset_required"])
        self.assertTrue(
            check_password(
                "green valley high school",
                member["security_answer_hash"],
            )
        )

        identity = self.member_client.get(
            "/api/auth/me/"
        )
        self.assertEqual(identity.status_code, 200)
        self.assertFalse(
            identity.data["password_reset_required"]
        )

    def test_wrong_school_answer_does_not_change_password(self):
        response = APIClient().post(
            "/api/auth/password/recover/",
            {
                "member_id": TEST_MEMBER,
                "school_answer": "Wrong School",
                "new_password": STRONG_PASSWORD,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

        self.user.refresh_from_db()
        self.assertTrue(
            self.user.check_password(TEST_MEMBER)
        )

        member = get_members_collection().find_one(
            {"member_id": TEST_MEMBER}
        )
        self.assertEqual(
            len(member.get("recovery_events", [])),
            1,
        )
        self.assertEqual(
            member["recovery_events"][0]["type"],
            "failed",
        )

    def test_recovery_locks_after_five_failed_answers(self):
        client = APIClient()

        for _ in range(5):
            response = client.post(
                "/api/auth/password/recover/",
                {
                    "member_id": TEST_MEMBER,
                    "school_answer": "Wrong School",
                    "new_password": STRONG_PASSWORD,
                },
                format="json",
            )
            self.assertEqual(response.status_code, 400)

        blocked = client.post(
            "/api/auth/password/recover/",
            {
                "member_id": TEST_MEMBER,
                "school_answer": "Wrong School",
                "new_password": STRONG_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, 429)

        member = get_members_collection().find_one(
            {"member_id": TEST_MEMBER}
        )
        self.assertEqual(member["status"], "active")
        self.assertEqual(
            len(
                [
                    event
                    for event in member.get(
                        "recovery_events", []
                    )
                    if event.get("type") == "failed"
                ]
            ),
            5,
        )

    def test_recovery_sets_warning_and_second_success_deactivates(self):
        client = APIClient()

        first = client.post(
            "/api/auth/password/recover/",
            {
                "member_id": TEST_MEMBER,
                "school_answer": "green valley high school",
                "new_password": STRONG_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(first.status_code, 200)
        self.assertFalse(first.data.get("deactivated", False))

        self.user.refresh_from_db()
        self.assertTrue(
            self.user.check_password(STRONG_PASSWORD)
        )

        member = get_members_collection().find_one(
            {"member_id": TEST_MEMBER}
        )
        self.assertTrue(member["password_reset_required"])
        self.assertEqual(member["status"], "active")

        second = client.post(
            "/api/auth/password/recover/",
            {
                "member_id": TEST_MEMBER,
                "school_answer": "GREEN VALLEY HIGH SCHOOL",
                "new_password": SECOND_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data.get("deactivated"))

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

        member = get_members_collection().find_one(
            {"member_id": TEST_MEMBER}
        )
        self.assertEqual(member["status"], "inactive")
        self.assertEqual(
            member["deactivation_reason"],
            "recovery_abuse",
        )

    def test_email_password_recovery_is_disabled(self):
        response = APIClient().post(
            "/api/auth/password/reset/",
            {"member_id": TEST_MEMBER},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

    def test_login_reports_password_reset_warning(self):
        response = APIClient().post(
            "/api/auth/login/",
            {
                "username": TEST_MEMBER,
                "password": TEST_MEMBER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            response.data["user"]["password_reset_required"]
        )

    def test_current_identity_reports_password_reset_warning(self):
        response = self.member_client.get(
            "/api/auth/me/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            response.data["password_reset_required"]
        )

    def test_staff_reactivation_resets_password_and_clears_answer(self):
        self.user.set_password(STRONG_PASSWORD)
        self.user.is_active = False
        self.user.save(update_fields=["password", "is_active"])

        get_members_collection().update_one(
            {"member_id": TEST_MEMBER},
            {
                "$set": {
                    "status": "inactive",
                    "password_reset_required": True,
                    "security_answer_hash": make_password(
                        normalize_school_answer(SCHOOL_ANSWER)
                    ),
                }
            },
        )

        response = self.staff_client.put(
            f"/api/members/{TEST_MEMBER}/",
            {"status": "active"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertTrue(
            self.user.check_password(TEST_MEMBER)
        )

        member = get_members_collection().find_one(
            {"member_id": TEST_MEMBER}
        )
        self.assertTrue(member["password_reset_required"])
        self.assertNotIn(
            "security_answer_hash",
            member,
        )
