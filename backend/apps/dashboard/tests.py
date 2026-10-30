from datetime import date
from unittest.mock import patch

from django.test import TestCase

from .repository import get_dashboard_data


class DashboardDateTests(TestCase):
    def test_dashboard_uses_gym_local_date(self):
        gym_date = date(2026, 1, 2)
        overview = {
            "date": gym_date.isoformat(),
            "sessions": [],
            "total_present": 0,
            "total_expected": 0,
        }

        with (
            patch(
                "apps.dashboard.repository.timezone.localdate",
                return_value=gym_date,
            ),
            patch(
                "apps.dashboard.repository.get_session_overview",
                return_value=overview,
            ) as session_overview,
            patch(
                "apps.dashboard.repository.get_all_members",
                return_value=[],
            ),
            patch(
                "apps.dashboard.repository.get_today_attendance",
                return_value=[],
            ),
            patch(
                "apps.dashboard.repository."
                "get_inactive_member_candidates",
                return_value=[],
            ),
            patch(
                "apps.dashboard.repository.get_all_memberships",
                return_value=[],
            ),
            patch(
                "apps.dashboard.repository.get_all_payments",
                return_value=[],
            ),
            patch(
                "apps.dashboard.repository.get_all_transformations",
                return_value=[],
            ),
        ):
            data = get_dashboard_data()

        session_overview.assert_called_once_with(gym_date)
        self.assertEqual(data["date"], gym_date.isoformat())
