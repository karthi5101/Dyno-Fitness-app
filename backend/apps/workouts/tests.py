"""Workout split rotation, completion and authorization tests.

These tests use the dedicated MongoDB test database only. Set:

    MONGODB_DATABASE=dyno_fitness_test

Otherwise every test is skipped so the production database can
never be touched by accident.
"""

import os
import unittest
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.authentication.models import UserMemberProfile
from apps.workouts import repositories as repo
from apps.workouts.database import (
    get_daily_workouts_collection,
    get_workout_assignments_collection,
    get_workout_templates_collection,
)

TEST_MEMBER = "TEST-WORKOUT-API-OWNER"
TEST_OTHER_MEMBER = "TEST-WORKOUT-API-OTHER"
TEMPLATE_NAME_PREFIX = "TEST-WORKOUT-API"

SPLIT_NOT_CONFIGURED = (
    "Split days are not configured for this workout template."
)

LEGACY_NOT_COMPLETABLE = (
    "This workout is not a split workout and cannot be completed."
)


def exercise(name):
    return {
        "name": name,
        "sets": 3,
        "reps": 10,
        "weight": "20",
    }


def split_days():
    labels = [
        "Chest",
        "Shoulders",
        "Back",
        "Biceps",
        "Triceps",
        "Legs",
    ]

    return [
        {
            "day": index + 1,
            "label": labels[index],
            "exercises": [exercise(labels[index] + " Exercise")],
        }
        for index in range(6)
    ]


def ensure_test_database():
    if os.getenv("MONGODB_DATABASE") != "dyno_fitness_test":
        raise unittest.SkipTest(
            "Set MONGODB_DATABASE=dyno_fitness_test to run "
            "workout split tests."
        )


class WorkoutSplitTests(TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_test_database()

        super().setUpClass()

        members = repo.get_members_collection()

        members.delete_many(
            {
                "member_id": {
                    "$in": [
                        TEST_MEMBER,
                        TEST_OTHER_MEMBER,
                    ]
                }
            }
        )

        members.insert_many(
            [
                {
                    "member_id": TEST_MEMBER,
                    "name": "Workout API Owner",
                },
                {
                    "member_id": TEST_OTHER_MEMBER,
                    "name": "Workout API Other",
                },
            ]
        )

        cls.split_template = repo.create_template(
            {
                "template_key": "strength",
                "name": TEMPLATE_NAME_PREFIX + " Split",
                "exercises": [exercise("Flat Bench Press")],
                "split_days": split_days(),
            }
        )

        cls.legacy_template = repo.create_template(
            {
                "template_key": "endurance",
                "name": TEMPLATE_NAME_PREFIX + " Legacy",
                "exercises": [exercise("Legacy Row")],
            }
        )

    @classmethod
    def tearDownClass(cls):
        daily = get_daily_workouts_collection()
        assignments = get_workout_assignments_collection()

        for member_id in (TEST_MEMBER, TEST_OTHER_MEMBER):
            daily.delete_many({"member_id": member_id})
            assignments.delete_many(
                {"member_id": member_id}
            )

        get_workout_templates_collection().delete_many(
            {
                "name": {
                    "$regex": "^" + TEMPLATE_NAME_PREFIX,
                }
            }
        )

        repo.get_members_collection().delete_many(
            {
                "member_id": {
                    "$in": [
                        TEST_MEMBER,
                        TEST_OTHER_MEMBER,
                    ]
                }
            }
        )

        super().tearDownClass()

    def setUp(self):
        daily = get_daily_workouts_collection()
        assignments = get_workout_assignments_collection()

        for member_id in (TEST_MEMBER, TEST_OTHER_MEMBER):
            daily.delete_many({"member_id": member_id})
            assignments.delete_many(
                {"member_id": member_id}
            )

        User = get_user_model()

        self.staff_user = User.objects.create_user(
            username="workout-api-staff",
            password="test-password",
            is_staff=True,
        )

        self.member_user = User.objects.create_user(
            username="workout-api-member",
            password="test-password",
        )

        UserMemberProfile.objects.create(
            user=self.member_user,
            member_id=TEST_MEMBER,
        )

        self.staff_client = APIClient()
        self.staff_client.force_authenticate(
            user=self.staff_user
        )

        self.member_client = APIClient()
        self.member_client.force_authenticate(
            user=self.member_user
        )

        self.anonymous_client = APIClient()

        repo.assign_template(
            TEST_MEMBER,
            self.split_template["_id"],
        )

        repo.assign_template(
            TEST_OTHER_MEMBER,
            self.split_template["_id"],
        )

    # -----------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------

    def complete_url(self, member_id):
        return "/api/workouts/daily/{}/complete/".format(
            member_id
        )

    def generate(self, client, member_id, workout_date, **extra):
        payload = {
            "member_id": member_id,
            "workout_date": workout_date.isoformat(),
            **extra,
        }

        return client.post(
            "/api/workouts/daily/generate/",
            payload,
            format="json",
        )

    # -----------------------------------------------------------------
    # Completion
    # -----------------------------------------------------------------

    def test_staff_completion_is_idempotent(self):
        workout = repo.create_daily_workout_from_assignment(
            TEST_MEMBER,
            date(2026, 1, 5),
        )

        url = self.complete_url(TEST_MEMBER)

        first = self.staff_client.post(
            url,
            {"workout_id": str(workout["_id"])},
            format="json",
        )

        self.assertEqual(first.status_code, 200)
        self.assertFalse(first.data["already_completed"])
        self.assertEqual(
            first.data["workout"]["status"],
            "completed",
        )
        self.assertEqual(
            first.data["workout"]["completed_by_role"],
            "staff",
        )

        completed_at = first.data["workout"]["completed_at"]
        self.assertIsNotNone(completed_at)

        second = self.staff_client.post(
            url,
            {"workout_id": str(workout["_id"])},
            format="json",
        )

        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data["already_completed"])
        self.assertEqual(
            second.data["workout"]["completed_at"],
            completed_at,
        )
        self.assertEqual(
            second.data["workout"]["completed_by_role"],
            "staff",
        )

    def test_completion_body_is_not_trusted(self):
        workout = repo.create_daily_workout_from_assignment(
            TEST_MEMBER,
            date(2026, 1, 6),
        )

        response = self.staff_client.post(
            self.complete_url(TEST_MEMBER),
            {
                "workout_id": str(workout["_id"]),
                "split_day": 6,
                "status": "completed",
                "completed_by_role": "member",
                "completed_at": "2000-01-01T00:00:00Z",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["workout"]["split_day"],
            1,
        )
        self.assertEqual(
            response.data["workout"]["completed_by_role"],
            "staff",
        )
        self.assertNotEqual(
            response.data["workout"]["completed_at"],
            "2000-01-01T00:00:00Z",
        )

    def test_member_can_complete_only_own_workout(self):
        own = repo.create_daily_workout_from_assignment(
            TEST_MEMBER,
            date(2026, 1, 7),
        )

        other = repo.create_daily_workout_from_assignment(
            TEST_OTHER_MEMBER,
            date(2026, 1, 7),
        )

        own_response = self.member_client.post(
            self.complete_url(TEST_MEMBER),
            {"workout_id": str(own["_id"])},
            format="json",
        )

        self.assertEqual(own_response.status_code, 200)
        self.assertEqual(
            own_response.data["workout"][
                "completed_by_role"
            ],
            "member",
        )

        other_response = self.member_client.post(
            self.complete_url(TEST_OTHER_MEMBER),
            {"workout_id": str(other["_id"])},
            format="json",
        )

        self.assertEqual(other_response.status_code, 404)

        stored = get_daily_workouts_collection().find_one(
            {"_id": other["_id"]}
        )

        self.assertEqual(stored.get("status"), "pending")

    def test_anonymous_cannot_complete(self):
        workout = repo.create_daily_workout_from_assignment(
            TEST_MEMBER,
            date(2026, 1, 8),
        )

        response = self.anonymous_client.post(
            self.complete_url(TEST_MEMBER),
            {"workout_id": str(workout["_id"])},
            format="json",
        )

        self.assertEqual(response.status_code, 401)

    def test_unlinked_member_account_is_denied(self):
        workout = repo.create_daily_workout_from_assignment(
            TEST_MEMBER,
            date(2026, 1, 9),
        )

        unlinked = APIClient()
        unlinked.force_authenticate(
            user=get_user_model().objects.create_user(
                username="workout-api-unlinked",
                password="test-password",
            )
        )

        response = unlinked.post(
            self.complete_url(TEST_MEMBER),
            {"workout_id": str(workout["_id"])},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_legacy_workout_cannot_be_completed(self):
        legacy = repo.create_daily_workout(
            member_id=TEST_MEMBER,
            workout_date=date(2026, 1, 10),
            exercises=[exercise("Legacy Row")],
            template_id=self.legacy_template["_id"],
            template_key="endurance",
        )

        response = self.staff_client.post(
            self.complete_url(TEST_MEMBER),
            {"workout_id": str(legacy["_id"])},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["detail"],
            LEGACY_NOT_COMPLETABLE,
        )

    def test_missing_workout_is_not_legacy(self):
        response = self.staff_client.post(
            self.complete_url(TEST_MEMBER),
            {"workout_id": "64b7f0c2f1a2b3c4d5e6f7a8"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.data["detail"],
            "Daily workout not found.",
        )

    def test_completion_requires_workout_id(self):
        response = self.staff_client.post(
            self.complete_url(TEST_MEMBER),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("workout_id", response.data)

    # -----------------------------------------------------------------
    # Generation and rotation
    # -----------------------------------------------------------------

    def test_generate_rotates_after_completion(self):
        first = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 2, 1),
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data["split_day"], 1)
        self.assertEqual(first.data["status"], "pending")
        self.assertEqual(
            first.data["split_day_label"],
            "Chest",
        )
        self.assertEqual(
            first.data["exercises"][0]["name"],
            "Chest Exercise",
        )

        duplicate = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 2, 1),
        )

        self.assertEqual(duplicate.status_code, 200)
        self.assertEqual(
            duplicate.data["workout"]["id"],
            first.data["id"],
        )

        completed = self.staff_client.post(
            self.complete_url(TEST_MEMBER),
            {"workout_id": first.data["id"]},
            format="json",
        )

        self.assertEqual(completed.status_code, 200)

        second = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 2, 2),
        )

        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.data["split_day"], 2)
        self.assertEqual(
            second.data["split_day_label"],
            "Shoulders",
        )

    def test_pending_workout_is_returned_across_dates(self):
        pending = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 2, 3),
        )

        self.assertEqual(pending.status_code, 201)

        later = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 2, 4),
        )

        self.assertEqual(later.status_code, 200)
        self.assertEqual(
            later.data["id"],
            pending.data["id"],
        )
        self.assertTrue(
            later.data["workout_date"].startswith(
                "2026-02-03"
            )
        )

    def test_explicit_split_requires_configuration(self):
        repo.assign_template(
            TEST_MEMBER,
            self.legacy_template["_id"],
        )

        response = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 2, 5),
            split=True,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["detail"],
            SPLIT_NOT_CONFIGURED,
        )

    def test_members_cannot_generate_workouts(self):
        response = self.generate(
            self.member_client,
            TEST_MEMBER,
            date(2026, 2, 6),
        )

        self.assertEqual(response.status_code, 403)

    # -----------------------------------------------------------------
    # Template configuration
    # -----------------------------------------------------------------

    def test_template_accepts_split_configuration(self):
        response = self.staff_client.post(
            "/api/workouts/templates/",
            {
                "template_key": "weight_gain",
                "name": TEMPLATE_NAME_PREFIX + " Created",
                "description": "",
                "exercises": [exercise("Back Squat")],
                "split_days": split_days(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            len(response.data["split_days"]),
            6,
        )
        self.assertEqual(
            response.data["split_days"][5]["label"],
            "Legs",
        )

    def test_template_rejects_incomplete_split(self):
        response = self.staff_client.post(
            "/api/workouts/templates/",
            {
                "template_key": "weight_gain",
                "name": TEMPLATE_NAME_PREFIX + " Invalid",
                "exercises": [exercise("Back Squat")],
                "split_days": split_days()[:5],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("split_days", response.data)

    def test_template_rejects_empty_split_day(self):
        invalid = split_days()
        invalid[2]["exercises"] = []

        response = self.staff_client.post(
            "/api/workouts/templates/",
            {
                "template_key": "weight_gain",
                "name": TEMPLATE_NAME_PREFIX + " Empty",
                "exercises": [exercise("Back Squat")],
                "split_days": invalid,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("split_days", response.data)

    # -----------------------------------------------------------------
    # Regression: existing read contracts
    # -----------------------------------------------------------------

    def test_member_can_read_own_daily_workout(self):
        workout = repo.create_daily_workout_from_assignment(
            TEST_MEMBER,
            date(2026, 3, 1),
        )

        response = self.member_client.get(
            "/api/workouts/daily/{}/?date=2026-03-01".format(
                TEST_MEMBER
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["id"],
            str(workout["_id"]),
        )
        self.assertEqual(
            response.data["split_day"],
            1,
        )

    def test_legacy_workout_serializes_with_nulls(self):
        legacy = repo.create_daily_workout(
            member_id=TEST_MEMBER,
            workout_date=date(2026, 3, 2),
            exercises=[exercise("Legacy Row")],
            template_id=self.legacy_template["_id"],
            template_key="endurance",
        )

        response = self.member_client.get(
            "/api/workouts/daily/{}/?date=2026-03-02".format(
                TEST_MEMBER
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["split_day"])
        self.assertIsNone(response.data["status"])
        self.assertEqual(
            response.data["exercises"][0]["name"],
            "Legacy Row",
        )

    def test_member_cannot_read_another_members_workout(self):
        repo.create_daily_workout_from_assignment(
            TEST_OTHER_MEMBER,
            date(2026, 3, 3),
        )

        response = self.member_client.get(
            "/api/workouts/daily/{}/?date=2026-03-03".format(
                TEST_OTHER_MEMBER
            )
        )

        self.assertEqual(response.status_code, 403)

    # -----------------------------------------------------------------
    # Full rotation, reuse, concurrency and integrity audit
    # -----------------------------------------------------------------

    def complete_workout(
        self,
        client,
        member_id,
        workout_id,
    ):
        return client.post(
            self.complete_url(member_id),
            {"workout_id": str(workout_id)},
            format="json",
        )

    def test_full_rotation_with_skip_week_boundary_and_reassignment(
        self,
    ):
        dates = [
            date(2026, 4, 1) + timedelta(days=offset)
            for offset in range(4)
        ]

        for expected_day, workout_date in enumerate(
            dates,
            start=1,
        ):
            generated = self.generate(
                self.staff_client,
                TEST_MEMBER,
                workout_date,
            )

            self.assertEqual(generated.status_code, 201)
            self.assertEqual(
                generated.data["split_day"],
                expected_day,
            )

            # Reading/generating must never complete a workout.
            opened = self.staff_client.get(
                "/api/workouts/daily/{}/?date={}".format(
                    TEST_MEMBER,
                    workout_date.isoformat(),
                )
            )
            self.assertEqual(opened.status_code, 200)
            self.assertEqual(opened.data["status"], "pending")

            self.assertEqual(
                repo.count_completed_split_workouts(
                    TEST_MEMBER,
                    "strength",
                ),
                expected_day - 1,
            )

            completed = self.complete_workout(
                self.staff_client,
                TEST_MEMBER,
                generated.data["id"],
            )
            self.assertEqual(completed.status_code, 200)
            self.assertFalse(
                completed.data["already_completed"]
            )

            self.assertEqual(
                repo.count_completed_split_workouts(
                    TEST_MEMBER,
                    "strength",
                ),
                expected_day,
            )

        # Skipping 2026-04-05 (Sunday) and 2026-04-06 (Monday)
        # must not advance the rotation. 2026-04-07 crosses the
        # calendar-week boundary.
        skipped = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 4, 7),
        )
        self.assertEqual(skipped.status_code, 201)
        self.assertEqual(skipped.data["split_day"], 5)

        self.assertEqual(
            self.complete_workout(
                self.staff_client,
                TEST_MEMBER,
                skipped.data["id"],
            ).status_code,
            200,
        )

        sixth = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 4, 8),
        )
        self.assertEqual(sixth.status_code, 201)
        self.assertEqual(sixth.data["split_day"], 6)
        self.assertEqual(sixth.data["split_day_label"], "Legs")

        self.assertEqual(
            self.complete_workout(
                self.staff_client,
                TEST_MEMBER,
                sixth.data["id"],
            ).status_code,
            200,
        )

        wrapped = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 4, 9),
        )
        self.assertEqual(wrapped.status_code, 201)
        self.assertEqual(wrapped.data["split_day"], 1)
        self.assertEqual(wrapped.data["split_day_label"], "Chest")

        self.assertEqual(
            self.complete_workout(
                self.staff_client,
                TEST_MEMBER,
                wrapped.data["id"],
            ).status_code,
            200,
        )

        # Reassigning the same template must not reset progress.
        repo.assign_template(
            TEST_MEMBER,
            self.split_template["_id"],
        )

        after_reassignment = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 4, 10),
        )
        self.assertEqual(after_reassignment.status_code, 201)
        self.assertEqual(after_reassignment.data["split_day"], 2)

    def test_previous_completed_exercises_are_reused(self):
        first = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 7, 1),
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data["split_day"], 1)

        edited = self.staff_client.put(
            "/api/workouts/daily/{}/?date=2026-07-01".format(
                TEST_MEMBER
            ),
            {
                "exercises": [
                    {
                        "name": "Member Custom Bench",
                        "sets": 5,
                        "reps": 6,
                        "weight": "42.5",
                        "order": 0,
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(edited.status_code, 200)

        self.assertEqual(
            self.complete_workout(
                self.staff_client,
                TEST_MEMBER,
                first.data["id"],
            ).status_code,
            200,
        )

        for offset in range(1, 6):
            generated = self.generate(
                self.staff_client,
                TEST_MEMBER,
                date(2026, 7, 1) + timedelta(days=offset),
            )
            self.assertEqual(generated.status_code, 201)
            self.assertEqual(
                generated.data["split_day"],
                offset + 1,
            )
            self.assertEqual(
                self.complete_workout(
                    self.staff_client,
                    TEST_MEMBER,
                    generated.data["id"],
                ).status_code,
                200,
            )

        # Updating the template must not rewrite the completed
        # snapshot, and the snapshot must win for reuse.
        rewritten = split_days()
        rewritten[0]["exercises"] = [
            exercise("Template Rewritten Chest")
        ]
        repo.update_template(
            self.split_template["_id"],
            {"split_days": rewritten},
        )

        try:
            again = self.generate(
                self.staff_client,
                TEST_MEMBER,
                date(2026, 7, 7),
            )
            self.assertEqual(again.status_code, 201)
            self.assertEqual(again.data["split_day"], 1)
            self.assertEqual(
                again.data["exercises"][0]["name"],
                "Member Custom Bench",
            )
            self.assertEqual(
                again.data["exercises"][0]["sets"],
                5,
            )
            self.assertEqual(
                again.data["exercises"][0]["reps"],
                6,
            )
            self.assertEqual(
                again.data["exercises"][0]["weight"],
                "42.5",
            )

            historical = repo.get_daily_workout(
                TEST_MEMBER,
                date(2026, 7, 1),
            )
            self.assertEqual(
                historical["exercises"][0]["name"],
                "Member Custom Bench",
            )

            # A newer pending workout must never be used as the
            # "latest completed" reuse source.
            now = repo.utc_now()
            get_daily_workouts_collection().insert_one(
                {
                    "member_id": TEST_MEMBER,
                    "workout_date": repo.normalize_workout_date(
                        date(2026, 7, 8)
                    ),
                    "template_id": self.split_template["_id"],
                    "template_key": "strength",
                    "exercises": [exercise("DECOY PENDING")],
                    "split_day": 1,
                    "split_day_label": "Chest",
                    "status": "pending",
                    "completed_at": None,
                    "completed_by_role": None,
                    "created_at": now,
                    "updated_at": now,
                }
            )

            latest = repo.get_latest_completed_split_workout(
                TEST_MEMBER,
                "strength",
                1,
            )
            self.assertEqual(
                latest["exercises"][0]["name"],
                "Member Custom Bench",
            )
            self.assertEqual(
                repo.count_completed_split_workouts(
                    TEST_MEMBER,
                    "strength",
                ),
                6,
            )
        finally:
            repo.update_template(
                self.split_template["_id"],
                {"split_days": split_days()},
            )

    def test_other_member_snapshot_does_not_leak(self):
        owner = repo.create_daily_workout(
            member_id=TEST_MEMBER,
            workout_date=date(2026, 8, 1),
            exercises=[exercise("Owner Chest")],
            template_id=self.split_template["_id"],
            template_key="strength",
            split_day=1,
            split_day_label="Chest",
            status="pending",
        )
        self.assertEqual(
            repo.complete_daily_workout(
                TEST_MEMBER,
                owner["_id"],
                "staff",
            )[0],
            "completed",
        )

        other = repo.create_daily_workout(
            member_id=TEST_OTHER_MEMBER,
            workout_date=date(2026, 8, 1),
            exercises=[exercise("Other Shoulders")],
            template_id=self.split_template["_id"],
            template_key="strength",
            split_day=2,
            split_day_label="Shoulders",
            status="pending",
        )
        self.assertEqual(
            repo.complete_daily_workout(
                TEST_OTHER_MEMBER,
                other["_id"],
                "staff",
            )[0],
            "completed",
        )

        generated = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 8, 2),
        )
        self.assertEqual(generated.status_code, 201)
        self.assertEqual(generated.data["split_day"], 2)
        self.assertEqual(
            generated.data["exercises"][0]["name"],
            "Shoulders Exercise",
        )

        latest = repo.get_latest_completed_split_workout(
            TEST_MEMBER,
            "strength",
            1,
        )
        self.assertEqual(
            latest["exercises"][0]["name"],
            "Owner Chest",
        )

    def test_completed_workout_cannot_be_deleted(self):

        first = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 9, 1),
        )
        self.assertEqual(first.data["split_day"], 1)
        self.assertEqual(
            self.complete_workout(
                self.staff_client,
                TEST_MEMBER,
                first.data["id"],
            ).status_code,
            200,
        )

        second = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 9, 2),
        )
        self.assertEqual(second.data["split_day"], 2)
        self.assertEqual(
            self.complete_workout(
                self.staff_client,
                TEST_MEMBER,
                second.data["id"],
            ).status_code,
            200,
        )

        self.assertEqual(
            repo.get_next_split_day(TEST_MEMBER, "strength"),
            3,
        )

        deleted = self.staff_client.delete(
            "/api/workouts/daily/{}/?date=2026-09-02".format(
                TEST_MEMBER
            )
        )
        self.assertEqual(deleted.status_code, 409)
        self.assertIn(
            "rotation history",
            deleted.data["detail"],
        )

        # Rotation history is preserved.
        self.assertEqual(
            repo.get_next_split_day(TEST_MEMBER, "strength"),
            3,
        )
        self.assertIsNotNone(
            repo.get_daily_workout(
                TEST_MEMBER,
                date(2026, 9, 2),
            )
        )

        generated = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 9, 3),
        )
        self.assertEqual(generated.status_code, 201)
        self.assertEqual(generated.data["split_day"], 3)

    def test_pending_workout_can_still_be_deleted(self):
        generated = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 9, 10),
        )
        self.assertEqual(generated.status_code, 201)

        deleted = self.staff_client.delete(
            "/api/workouts/daily/{}/?date=2026-09-10".format(
                TEST_MEMBER
            )
        )
        self.assertEqual(deleted.status_code, 204)
        self.assertIsNone(
            repo.get_daily_workout(
                TEST_MEMBER,
                date(2026, 9, 10),
            )
        )

    def test_concurrent_generation_creates_one_workout(self):
        from concurrent.futures import ThreadPoolExecutor
        import threading

        workout_date = date(2026, 10, 5)
        barrier = threading.Barrier(4)

        def attempt(_index):
            barrier.wait()
            return repo.create_daily_workout_from_assignment(
                TEST_MEMBER,
                workout_date,
            )

        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(attempt, range(4)))

        self.assertEqual(
            len(
                {
                    str(result["_id"])
                    for result in results
                }
            ),
            1,
        )
        self.assertEqual(
            get_daily_workouts_collection().count_documents(
                {
                    "member_id": TEST_MEMBER,
                    "workout_date": repo.normalize_workout_date(
                        workout_date
                    ),
                }
            ),
            1,
        )

    def test_concurrent_completion_over_http(self):
        from concurrent.futures import ThreadPoolExecutor

        workout = repo.create_daily_workout_from_assignment(
            TEST_MEMBER,
            date(2026, 10, 1),
        )

        def attempt(_index):
            client = APIClient()
            client.force_authenticate(
                user=self.staff_user
            )
            response = client.post(
                self.complete_url(TEST_MEMBER),
                {"workout_id": str(workout["_id"])},
                format="json",
            )
            return (
                response.status_code,
                response.data.get("already_completed"),
                response.data.get("workout", {}).get(
                    "completed_at"
                ),
            )

        with ThreadPoolExecutor(max_workers=8) as pool:
            outcomes = list(pool.map(attempt, range(8)))

        self.assertEqual(
            [outcome[0] for outcome in outcomes],
            [200] * 8,
        )
        self.assertEqual(
            sum(
                1
                for outcome in outcomes
                if outcome[1] is False
            ),
            1,
        )
        self.assertEqual(
            sum(
                1
                for outcome in outcomes
                if outcome[1] is True
            ),
            7,
        )
        completed_times = {
            outcome[2] for outcome in outcomes
        }
        self.assertEqual(len(completed_times), 1)
        self.assertEqual(
            repo.count_completed_split_workouts(
                TEST_MEMBER,
                "strength",
            ),
            1,
        )

    def test_template_split_update_persists_and_generates_day(self):
        days = split_days()
        days[3]["exercises"] = [
            exercise("Hammer Curl Custom")
        ]

        updated = self.staff_client.put(
            "/api/workouts/templates/{}/".format(
                self.split_template["_id"]
            ),
            {"split_days": days},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)

        try:
            fresh = self.staff_client.get(
                "/api/workouts/templates/{}/".format(
                    self.split_template["_id"]
                )
            )
            self.assertEqual(fresh.status_code, 200)
            self.assertEqual(
                fresh.data["split_days"][3]["exercises"][0][
                    "name"
                ],
                "Hammer Curl Custom",
            )

            for day_number in (1, 2, 3):
                seeded = repo.create_daily_workout(
                    member_id=TEST_MEMBER,
                    workout_date=date(2026, 11, day_number),
                    exercises=[exercise("Seed " + str(day_number))],
                    template_id=self.split_template["_id"],
                    template_key="strength",
                    split_day=day_number,
                    split_day_label=split_days()[
                        day_number - 1
                    ]["label"],
                    status="pending",
                )
                self.assertEqual(
                    repo.complete_daily_workout(
                        TEST_MEMBER,
                        seeded["_id"],
                        "staff",
                    )[0],
                    "completed",
                )

            generated = self.generate(
                self.staff_client,
                TEST_MEMBER,
                date(2026, 11, 4),
            )
            self.assertEqual(generated.status_code, 201)
            self.assertEqual(generated.data["split_day"], 4)
            self.assertEqual(
                generated.data["exercises"][0]["name"],
                "Hammer Curl Custom",
            )
        finally:
            repo.update_template(
                self.split_template["_id"],
                {"split_days": split_days()},
            )

    def test_all_four_template_keys_accept_split_configuration(
        self,
    ):
        created_ids = []

        try:
            for template_key in (
                "weight_loss",
                "weight_gain",
            ):
                response = self.staff_client.post(
                    "/api/workouts/templates/",
                    {
                        "template_key": template_key,
                        "name": TEMPLATE_NAME_PREFIX
                        + " Four "
                        + template_key,
                        "exercises": [exercise("Flat Base")],
                        "split_days": split_days(),
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, 201)
                self.assertEqual(
                    len(response.data["split_days"]),
                    6,
                )
                created_ids.append(response.data["id"])

            strength = self.staff_client.put(
                "/api/workouts/templates/{}/".format(
                    self.split_template["_id"]
                ),
                {"split_days": split_days()},
                format="json",
            )
            self.assertEqual(strength.status_code, 200)
            self.assertEqual(len(strength.data["split_days"]), 6)

            endurance = self.staff_client.put(
                "/api/workouts/templates/{}/".format(
                    self.legacy_template["_id"]
                ),
                {"split_days": split_days()},
                format="json",
            )
            self.assertEqual(endurance.status_code, 200)
            self.assertEqual(len(endurance.data["split_days"]), 6)
        finally:
            get_workout_templates_collection().delete_many(
                {
                    "_id": {
                        "$in": [
                            repo.normalize_template_id(
                                template_id
                            )
                            for template_id in created_ids
                        ]
                    }
                }
            )
            get_workout_templates_collection().update_one(
                {"_id": self.legacy_template["_id"]},
                {"$unset": {"split_days": ""}},
            )

    def test_template_rejects_duplicate_day_numbers(self):
        invalid = split_days()
        invalid[5]["day"] = 5

        response = self.staff_client.post(
            "/api/workouts/templates/",
            {
                "template_key": "weight_gain",
                "name": TEMPLATE_NAME_PREFIX + " Duplicate",
                "exercises": [exercise("Back Squat")],
                "split_days": invalid,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("split_days", response.data)

    def test_unrelated_collections_are_untouched(self):
        from core.database.mongodb import MongoDB

        database = MongoDB.get_database()
        names = [
            "attendance",
            "payments",
            "memberships",
            "diet_templates",
            "diet_assignments",
            "transformations",
            "member_notes",
        ]
        before = {
            name: database[name].count_documents({})
            for name in names
        }

        generated = self.generate(
            self.staff_client,
            TEST_MEMBER,
            date(2026, 12, 1),
        )
        self.assertEqual(generated.status_code, 201)
        self.assertEqual(
            self.complete_workout(
                self.staff_client,
                TEST_MEMBER,
                generated.data["id"],
            ).status_code,
            200,
        )

        after = {
            name: database[name].count_documents({})
            for name in names
        }
        self.assertEqual(before, after)
