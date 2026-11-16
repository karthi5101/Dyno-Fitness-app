import os
import unittest
from datetime import datetime, timezone

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.authentication.models import UserMemberProfile
from apps.members.database import get_members_collection
from apps.training.database import (
    get_assignment_history_collection,
    get_assignments_collection,
    get_programs_collection,
    get_sessions_collection,
)

TEST_PREFIX = "TEST-ASSIGN-"


def ensure_test_database():
    if os.getenv("MONGODB_DATABASE") != "dyno_fitness_test":
        raise unittest.SkipTest(
            "Set MONGODB_DATABASE=dyno_fitness_test to run "
            "training assignments tests."
        )


@override_settings(WORKOUTS_V2_ENABLED=True)
class TrainingAssignmentsTests(TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_test_database()
        super().setUpClass()

        User = get_user_model()
        cls.staff_user = User.objects.create_user(
            username=TEST_PREFIX + "staff",
            password="test-password",
            is_staff=True,
        )
        cls.member_user = User.objects.create_user(
            username=TEST_PREFIX + "member",
            password="test-password",
        )

        cls.staff_client = APIClient()
        cls.staff_client.force_authenticate(cls.staff_user)

        cls.member_client = APIClient()
        cls.member_client.force_authenticate(cls.member_user)

    @classmethod
    def tearDownClass(cls):
        User = get_user_model()
        User.objects.filter(username__startswith=TEST_PREFIX).delete()
        super().tearDownClass()

    def setUp(self):
        get_assignments_collection().drop()
        get_assignment_history_collection().drop()
        get_programs_collection().drop()
        get_sessions_collection().drop()
        get_members_collection().delete_many({"member_id": {"$regex": f"^{TEST_PREFIX}"}})

        self.member_id = TEST_PREFIX + "M001"
        self.inactive_member_id = TEST_PREFIX + "M002"

        get_members_collection().insert_one({
            "member_id": self.member_id,
            "name": "Active Test Member",
            "phone": "9999999991",
            "email": "active@example.com",
            "status": "active",
            "joining_date": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })

        get_members_collection().insert_one({
            "member_id": self.inactive_member_id,
            "name": "Inactive Test Member",
            "phone": "9999999992",
            "email": "inactive@example.com",
            "status": "inactive",
            "joining_date": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })

        UserMemberProfile.objects.update_or_create(
            user=self.member_user,
            defaults={"member_id": self.member_id},
        )

        # Create sample program
        program_doc = {
            "name": "Test PPL Program",
            "name_lc": "test ppl program",
            "description": "Push pull legs test",
            "duration_weeks": 8,
            "version": 1,
            "created_by": self.staff_user.username,
            "archived": False,
            "days": [
                {
                    "day_key": "day_a",
                    "label": "Push Day",
                    "order": 1,
                    "blocks": [
                        {
                            "block_id": "b1",
                            "exercise_id": "ex1",
                            "exercise_name": "Bench Press",
                            "tracking_type": "weight_reps",
                            "notes": "Go heavy",
                            "sets": [
                                {
                                    "set_no": 1,
                                    "set_type": "normal",
                                    "reps_min": 8,
                                    "reps_max": 10,
                                    "weight_kg": 60,
                                    "duration_s": None,
                                    "rpe_target": None,
                                }
                            ],
                        }
                    ],
                },
                {
                    "day_key": "day_b",
                    "label": "Pull Day",
                    "order": 2,
                    "blocks": [],
                },
            ],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        res = get_programs_collection().insert_one(program_doc)
        self.program_id = str(res.inserted_id)

    def test_non_staff_forbidden(self):
        resp = self.member_client.get(f"/api/training/members/{self.member_id}/assignment/")
        self.assertEqual(resp.status_code, 403)

    def test_member_not_found(self):
        resp = self.staff_client.get("/api/training/members/UNKNOWN999/assignment/")
        self.assertEqual(resp.status_code, 404)

    def test_create_and_get_assignment(self):
        post_resp = self.staff_client.post(
            f"/api/training/members/{self.member_id}/assignment/",
            {
                "program_id": self.program_id,
                "mode": "rotation",
                "pointer": 0,
                "start_date": "2026-01-01",
            },
            format="json",
        )
        self.assertEqual(post_resp.status_code, 201)
        data = post_resp.json()
        self.assertIn("assignment", data)
        self.assertEqual(data["assignment"]["member_id"], self.member_id)
        self.assertEqual(data["assignment"]["mode"], "rotation")

        # GET assignment
        get_resp = self.staff_client.get(f"/api/training/members/{self.member_id}/assignment/")
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json()["assignment"]["id"], data["assignment"]["id"])

    def test_cannot_assign_inactive_member(self):
        resp = self.staff_client.post(
            f"/api/training/members/{self.inactive_member_id}/assignment/",
            {
                "program_id": self.program_id,
                "mode": "rotation",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 409)

    def test_patch_and_end_assignment(self):
        self.staff_client.post(
            f"/api/training/members/{self.member_id}/assignment/",
            {
                "program_id": self.program_id,
                "mode": "rotation",
                "pointer": 0,
                "start_date": "2026-01-01",
            },
            format="json",
        )

        patch_resp = self.staff_client.patch(
            f"/api/training/members/{self.member_id}/assignment/",
            {"pointer": 1},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.json()["assignment"]["pointer"], 1)

        end_resp = self.staff_client.post(
            f"/api/training/members/{self.member_id}/assignment/end/",
            {},
            format="json",
        )
        self.assertEqual(end_resp.status_code, 200)
        self.assertEqual(end_resp.json()["assignment"]["status"], "ended")

    def test_history_and_adherence(self):
        self.staff_client.post(
            f"/api/training/members/{self.member_id}/assignment/",
            {
                "program_id": self.program_id,
                "mode": "rotation",
                "start_date": "2026-01-01",
            },
            format="json",
        )

        hist_resp = self.staff_client.get(f"/api/training/members/{self.member_id}/history/")
        self.assertEqual(hist_resp.status_code, 200)
        self.assertTrue(len(hist_resp.json()["assignments"]) >= 1)

        adh_resp = self.staff_client.get(f"/api/training/members/{self.member_id}/adherence/")
        self.assertEqual(adh_resp.status_code, 200)

    @override_settings(WORKOUTS_V2_ENABLED=False)
    def test_flag_off_returns_404(self):
        resp = self.staff_client.get(f"/api/training/members/{self.member_id}/assignment/")
        self.assertEqual(resp.status_code, 404)
