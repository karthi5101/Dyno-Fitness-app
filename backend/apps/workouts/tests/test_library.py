import os
import unittest
from datetime import datetime, timezone as dt_timezone
from urllib.parse import quote

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.workouts.database import get_exercises_collection


TEST_PREFIX = "TEST-TRAINING-"
TEST_STAFF = TEST_PREFIX + "STAFF"
TEST_MEMBER = TEST_PREFIX + "MEMBER"


def ensure_test_database():
    if os.getenv("MONGODB_DATABASE") != "dyno_fitness_test":
        raise unittest.SkipTest(
            "Set MONGODB_DATABASE=dyno_fitness_test to run "
            "training library tests."
        )


@override_settings(WORKOUTS_V2_ENABLED=True)
class TrainingLibraryTests(TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_test_database()
        super().setUpClass()

        User = get_user_model()
        cls.staff = User.objects.create_user(
            username=TEST_STAFF,
            password="test-password",
            is_staff=True,
        )
        cls.member = User.objects.create_user(
            username=TEST_MEMBER,
            password="test-password",
        )
        cls.staff_client = APIClient()
        cls.staff_client.force_authenticate(cls.staff)
        cls.member_client = APIClient()
        cls.member_client.force_authenticate(cls.member)

    @classmethod
    def tearDownClass(cls):
        get_exercises_collection().drop()
        User = get_user_model()
        User.objects.filter(
            username__startswith=TEST_PREFIX
        ).delete()

        super().tearDownClass()

    def setUp(self):
        collection = get_exercises_collection()
        collection.drop()
        now = datetime.now(dt_timezone.utc)

        documents = [
            {
                "slug": "barbell-bench-press",
                "name": "Barbell Bench Press",
                "name_lc": "barbell bench press",
                "primary_muscles": ["chest"],
                "secondary_muscles": ["triceps"],
                "equipment": "barbell",
                "level": "intermediate",
                "category": "strength",
                "instructions": ["Press the bar."],
                "images": ["barbell-bench-press/0.jpg"],
                "video_file_id": None,
                "tracking_type": "weight_reps",
                "is_custom": False,
                "created_by": None,
                "archived": False,
                "favorite_by": [TEST_STAFF],
                "created_at": now,
                "updated_at": now,
            },
            {
                "slug": "dumbbell-flyes",
                "name": "Dumbbell Flyes",
                "name_lc": "dumbbell flyes",
                "primary_muscles": ["chest"],
                "secondary_muscles": ["shoulders"],
                "equipment": "dumbbell",
                "level": "beginner",
                "category": "strength",
                "instructions": ["Open the arms."],
                "images": ["dumbbell-flyes/0.jpg"],
                "video_file_id": None,
                "tracking_type": "weight_reps",
                "is_custom": False,
                "created_by": None,
                "archived": False,
                "favorite_by": [],
                "created_at": now,
                "updated_at": now,
            },
            {
                "slug": "treadmill-run",
                "name": "Treadmill Run",
                "name_lc": "treadmill run",
                "primary_muscles": ["quadriceps"],
                "secondary_muscles": ["calves"],
                "equipment": "machine",
                "level": "beginner",
                "category": "cardio",
                "instructions": ["Run at a steady pace."],
                "images": ["treadmill-run/0.jpg"],
                "video_file_id": None,
                "tracking_type": "time",
                "is_custom": False,
                "created_by": None,
                "archived": False,
                "favorite_by": [],
                "created_at": now,
                "updated_at": now,
            },
            {
                "slug": "coach-band-pull-apart",
                "name": "Coach Band Pull-Apart",
                "name_lc": "coach band pull-apart",
                "primary_muscles": ["shoulders"],
                "secondary_muscles": ["upper back"],
                "equipment": "bands",
                "level": "beginner",
                "category": "strength",
                "instructions": ["Pull the band apart."],
                "images": [],
                "video_file_id": None,
                "tracking_type": "reps",
                "is_custom": True,
                "created_by": TEST_STAFF,
                "archived": False,
                "favorite_by": [],
                "created_at": now,
                "updated_at": now,
            },
        ]

        result = collection.insert_many(documents)
        self.bench_id = str(result.inserted_ids[0])
        self.flyes_id = str(result.inserted_ids[1])
        self.run_id = str(result.inserted_ids[2])
        self.custom_id = str(result.inserted_ids[3])

    def names(self, response):
        return {
            item["name"]
            for item in response.json()["results"]
        }

    def test_search_returns_matching_exercise(self):
        response = self.staff_client.get(
            "/api/training/exercises/?q=bench"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.names(response),
            {"Barbell Bench Press"},
        )

    def test_muscle_filter_matches_primary_and_secondary(self):
        primary = self.staff_client.get(
            "/api/training/exercises/?muscle=chest"
        )
        secondary = self.staff_client.get(
            "/api/training/exercises/?muscle=triceps"
        )

        self.assertEqual(
            self.names(primary),
            {"Barbell Bench Press", "Dumbbell Flyes"},
        )
        self.assertEqual(
            self.names(secondary),
            {"Barbell Bench Press"},
        )

    def test_equipment_filter(self):
        response = self.staff_client.get(
            "/api/training/exercises/?equipment=barbell"
        )

        self.assertEqual(
            self.names(response),
            {"Barbell Bench Press"},
        )

    def test_level_filter(self):
        response = self.staff_client.get(
            "/api/training/exercises/?level=beginner"
        )

        self.assertEqual(
            self.names(response),
            {
                "Dumbbell Flyes",
                "Treadmill Run",
                "Coach Band Pull-Apart",
            },
        )

    def test_category_filter(self):
        response = self.staff_client.get(
            "/api/training/exercises/?category=cardio"
        )

        self.assertEqual(
            self.names(response),
            {"Treadmill Run"},
        )

    def test_favorite_filter_is_user_scoped(self):
        staff_response = self.staff_client.get(
            "/api/training/exercises/?favorite=true"
        )
        member_response = self.member_client.get(
            "/api/training/exercises/?favorite=true"
        )

        self.assertEqual(
            self.names(staff_response),
            {"Barbell Bench Press"},
        )
        self.assertEqual(self.names(member_response), set())

    def test_cursor_paging_returns_each_exercise_once(self):
        first = self.staff_client.get(
            "/api/training/exercises/?limit=2"
        )
        first_data = first.json()

        self.assertEqual(first.status_code, 200)
        self.assertEqual(len(first_data["results"]), 2)
        self.assertTrue(first_data["next_cursor"])

        second = self.staff_client.get(
            "/api/training/exercises/"
            f"?limit=2&cursor={quote(first_data['next_cursor'])}"
        )
        second_data = second.json()

        self.assertEqual(second.status_code, 200)
        self.assertEqual(len(second_data["results"]), 2)
        self.assertIsNone(second_data["next_cursor"])

        first_ids = {
            item["id"] for item in first_data["results"]
        }
        second_ids = {
            item["id"] for item in second_data["results"]
        }

        self.assertTrue(first_ids.isdisjoint(second_ids))
        self.assertEqual(
            len(first_ids | second_ids),
            4,
        )

    def test_limit_above_fifty_is_rejected(self):
        response = self.staff_client.get(
            "/api/training/exercises/?limit=51"
        )

        self.assertEqual(response.status_code, 400)

    def test_detail_returns_one_exercise(self):
        response = self.staff_client.get(
            f"/api/training/exercises/{self.bench_id}/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["name"],
            "Barbell Bench Press",
        )

    def test_member_cannot_create_exercise(self):
        response = self.member_client.post(
            "/api/training/exercises/",
            {
                "name": "Member Exercise",
                "equipment": "body only",
                "category": "strength",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_staff_can_create_custom_exercise(self):
        response = self.staff_client.post(
            "/api/training/exercises/",
            {
                "name": "Coach Kettlebell Carry",
                "primary_muscles": ["forearms"],
                "equipment": "kettlebells",
                "level": "beginner",
                "category": "strength",
                "instructions": ["Carry with control."],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["is_custom"])
        self.assertEqual(
            response.json()["tracking_type"],
            "weight_reps",
        )

    def test_system_exercise_is_immutable(self):
        response = self.staff_client.patch(
            f"/api/training/exercises/{self.bench_id}/",
            {"name": "Changed Name"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_staff_can_patch_custom_exercise(self):
        response = self.staff_client.patch(
            f"/api/training/exercises/{self.custom_id}/",
            {
                "name": "Updated Band Pull-Apart",
                "equipment": "body only",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["name"],
            "Updated Band Pull-Apart",
        )
        self.assertEqual(
            response.json()["tracking_type"],
            "reps",
        )

    def test_member_can_read_but_not_write(self):
        read = self.member_client.get(
            "/api/training/exercises/"
        )
        write = self.member_client.patch(
            f"/api/training/exercises/{self.custom_id}/",
            {"name": "Nope"},
            format="json",
        )

        self.assertEqual(read.status_code, 200)
        self.assertEqual(write.status_code, 403)

    @override_settings(WORKOUTS_V2_ENABLED=False)
    def test_library_is_hidden_when_flag_is_off(self):
        response = self.staff_client.get(
            "/api/training/exercises/"
        )

        self.assertEqual(response.status_code, 404)

    def test_media_serves_image_with_cache_headers(self):
        response = self.staff_client.get(
            "/api/training/media/exercises/3-4-sit-up/0/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["Content-Type"],
            "image/jpeg",
        )
        self.assertIn(
            "max-age=86400",
            response["Cache-Control"],
        )

    def test_media_rejects_path_traversal(self):
        response = self.staff_client.get(
            "/api/training/media/exercises/"
            "%2e%2e%2fsecret/0/"
        )

        self.assertIn(response.status_code, (400, 404))

    def test_media_missing_image_returns_404(self):
        response = self.staff_client.get(
            "/api/training/media/exercises/"
            "does-not-exist/0/"
        )

        self.assertEqual(response.status_code, 404)
