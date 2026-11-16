from django.test import TestCase, override_settings
from rest_framework.test import APIClient


class TrainingHealthFlagTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @override_settings(WORKOUTS_V2_ENABLED=False)
    def test_health_returns_404_when_flag_is_off(self):
        response = self.client.get("/api/training/health/")

        self.assertEqual(response.status_code, 404)

    @override_settings(WORKOUTS_V2_ENABLED=True)
    def test_health_returns_200_when_flag_is_on(self):
        response = self.client.get("/api/training/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "status": "ok",
                "module": "training",
            },
        )
