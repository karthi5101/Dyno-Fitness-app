import io
import os
import unittest

from django.core.management import call_command
from django.test import TestCase

from apps.training.database import get_exercises_collection


def ensure_test_database():
    if os.getenv("MONGODB_DATABASE") != "dyno_fitness_test":
        raise unittest.SkipTest(
            "Set MONGODB_DATABASE=dyno_fitness_test to run "
            "training seed tests."
        )


class TrainingSeedTests(TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_test_database()
        super().setUpClass()
        get_exercises_collection().drop()

    @classmethod
    def tearDownClass(cls):
        get_exercises_collection().drop()
        super().tearDownClass()

    def setUp(self):
        get_exercises_collection().drop()

    def test_seed_is_idempotent_and_maps_tracking_types(self):
        output = io.StringIO()

        call_command(
            "seed_training_library",
            stdout=output,
        )
        first_count = get_exercises_collection().count_documents(
            {}
        )

        call_command(
            "seed_training_library",
            stdout=output,
        )
        collection = get_exercises_collection()
        second_count = collection.count_documents({})

        self.assertEqual(first_count, second_count)
        self.assertEqual(first_count, 876)
        self.assertEqual(
            collection.count_documents(
                {
                    "category": "cardio",
                    "tracking_type": {"$ne": "time"},
                }
            ),
            0,
        )
        self.assertEqual(
            collection.count_documents(
                {
                    "equipment": "body only",
                    "category": {
                        "$nin": ["cardio", "stretching"],
                    },
                    "tracking_type": {"$ne": "reps"},
                }
            ),
            0,
        )
        self.assertEqual(
            collection.count_documents(
                {
                    "category": "strength",
                    "equipment": "barbell",
                    "tracking_type": {
                        "$ne": "weight_reps",
                    },
                }
            ),
            0,
        )
