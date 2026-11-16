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

TEST_PREFIX = "TEST-SESS-"


def ensure_test_database():
    if os.getenv("MONGODB_DATABASE") != "dyno_fitness_test":
        raise unittest.SkipTest(
            "Set MONGODB_DATABASE=dyno_fitness_test to run "
            "training sessions tests."
        )


@override_settings(WORKOUTS_V2_ENABLED=True)
class TrainingSessionsTests(TestCase):
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
        cls.unlinked_user = User.objects.create_user(
            username=TEST_PREFIX + "unlinked",
            password="test-password",
        )

        cls.staff_client = APIClient()
        cls.staff_client.force_authenticate(cls.staff_user)

        cls.member_client = APIClient()
        cls.member_client.force_authenticate(cls.member_user)

        cls.unlinked_client = APIClient()
        cls.unlinked_client.force_authenticate(cls.unlinked_user)

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

        get_members_collection().insert_one({
            "member_id": self.member_id,
            "name": "Session Test Member",
            "phone": "9999999993",
            "email": "session@example.com",
            "status": "active",
            "joining_date": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })

        UserMemberProfile.objects.update_or_create(
            user=self.member_user,
            defaults={"member_id": self.member_id},
        )

        # Create program
        program_doc = {
            "name": "Session Program",
            "name_lc": "session program",
            "description": "Session test program",
            "duration_weeks": 4,
            "version": 1,
            "created_by": self.staff_user.username,
            "archived": False,
            "days": [
                {
                    "day_key": "day_a",
                    "label": "Day A - Push",
                    "order": 1,
                    "blocks": [
                        {
                            "block_id": "blk-bench",
                            "exercise_id": "ex-bench",
                            "exercise_name": "Bench Press",
                            "tracking_type": "weight_reps",
                            "notes": "Focus on form",
                            "sets": [
                                {
                                    "set_no": 1,
                                    "set_type": "normal",
                                    "reps_min": 8,
                                    "reps_max": 10,
                                    "weight_kg": 50,
                                }
                            ],
                        }
                    ],
                }
            ],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        res = get_programs_collection().insert_one(program_doc)
        self.program_id = str(res.inserted_id)

        # Create active assignment for the member
        assign_resp = self.staff_client.post(
            f"/api/training/members/{self.member_id}/assignment/",
            {
                "program_id": self.program_id,
                "mode": "rotation",
                "pointer": 0,
                "start_date": "2020-01-01",
            },
            format="json",
        )
        self.assertEqual(assign_resp.status_code, 201)

    def test_unlinked_user_gets_404(self):
        resp = self.unlinked_client.get("/api/training/me/today/")
        self.assertEqual(resp.status_code, 404)
        self.assertIn("No member profile", resp.json()["detail"])

    def test_get_today_and_start_session(self):
        today_resp = self.member_client.get("/api/training/me/today/")
        self.assertEqual(today_resp.status_code, 200)
        today_data = today_resp.json()
        self.assertIsNotNone(today_data["assignment"])
        self.assertEqual(today_data["rest_day"], False)

        start_resp = self.member_client.post("/api/training/sessions/start/", {}, format="json")
        self.assertEqual(start_resp.status_code, 200)
        session_data = start_resp.json()
        self.session_id = session_data["id"]
        self.assertEqual(session_data["status"], "in_progress")
        self.assertEqual(session_data["member_id"], self.member_id)

    def test_log_sets_complete_and_history(self):
        start_resp = self.member_client.post("/api/training/sessions/start/", {}, format="json")
        self.assertEqual(start_resp.status_code, 200)
        session_id = start_resp.json()["id"]

        # Log sets
        sets_payload = {
            "sets": [
                {
                    "client_set_id": "cset-1",
                    "exercise_id": "ex-bench",
                    "block_id": "blk-bench",
                    "set_no": 1,
                    "reps": 10,
                    "weight_kg": 60,
                    "done": True,
                }
            ]
        }
        log_resp = self.member_client.put(
            f"/api/training/sessions/{session_id}/sets/",
            sets_payload,
            format="json",
        )
        self.assertEqual(log_resp.status_code, 200)
        self.assertEqual(log_resp.json()["sets_applied"], 1)

        # Complete session
        comp_resp = self.member_client.post(
            f"/api/training/sessions/{session_id}/complete/",
            {},
            format="json",
        )
        self.assertEqual(comp_resp.status_code, 200)
        self.assertEqual(comp_resp.json()["session"]["status"], "completed")
        self.assertEqual(comp_resp.json()["already_completed"], False)

        # Last exercise (after completing session)
        last_resp = self.member_client.get("/api/training/me/exercises/ex-bench/last/")
        self.assertEqual(last_resp.status_code, 200)
        self.assertEqual(last_resp.json()["exercise_id"], "ex-bench")

        # Completing again returns already_completed True
        comp2 = self.member_client.post(
            f"/api/training/sessions/{session_id}/complete/",
            {},
            format="json",
        )
        self.assertEqual(comp2.status_code, 200)
        self.assertEqual(comp2.json()["already_completed"], True)

        # Member history
        hist_resp = self.member_client.get("/api/training/me/history/")
        self.assertEqual(hist_resp.status_code, 200)
        self.assertTrue(len(hist_resp.json()) >= 1)

        # Member plan
        plan_resp = self.member_client.get("/api/training/me/plan/")
        self.assertEqual(plan_resp.status_code, 200)

    def test_staff_session_endpoints(self):
        # Staff history
        shist = self.staff_client.get(f"/api/training/staff/members/{self.member_id}/history/")
        self.assertEqual(shist.status_code, 200)

        # Staff adherence
        sadh = self.staff_client.get(f"/api/training/staff/members/{self.member_id}/adherence/")
        self.assertEqual(sadh.status_code, 200)

        # Staff plan
        splan = self.staff_client.get(f"/api/training/staff/members/{self.member_id}/plan/")
        self.assertEqual(splan.status_code, 200)

        # Start and complete session to test staff correction
        s_resp = self.member_client.post("/api/training/sessions/start/", {}, format="json")
        session_id = s_resp.json()["id"]
        self.member_client.post(f"/api/training/sessions/{session_id}/complete/", {}, format="json")

        corr_resp = self.staff_client.post(
            f"/api/training/sessions/{session_id}/corrections/",
            {"reason": "Good session form"},
            format="json",
        )
        self.assertEqual(corr_resp.status_code, 200)

    @override_settings(WORKOUTS_V2_ENABLED=False)
    def test_flag_off_returns_404(self):
        resp = self.member_client.get("/api/training/me/today/")
        self.assertEqual(resp.status_code, 404)
