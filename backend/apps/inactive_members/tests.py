from datetime import datetime, time, timedelta

from django.test import TestCase
from django.utils import timezone

from apps.attendance.database import get_attendance_collection
from apps.members.database import get_members_collection

from .repository import get_inactive_member_candidates


class InactiveMemberCandidateTests(TestCase):
    member_ids = [
        "TEST-INACTIVE-NO-ATTENDANCE",
        "TEST-INACTIVE-ATTENDED",
    ]

    def setUp(self):
        self.members = get_members_collection()
        self.attendance = get_attendance_collection()

        self.members.delete_many(
            {"member_id": {"$in": self.member_ids}}
        )
        self.attendance.delete_many(
            {"member_id": {"$in": self.member_ids}}
        )

    def tearDown(self):
        self.members.delete_many(
            {"member_id": {"$in": self.member_ids}}
        )
        self.attendance.delete_many(
            {"member_id": {"$in": self.member_ids}}
        )

    def test_candidate_distinguishes_attendance_from_joining_date(self):
        today = timezone.localdate()

        self.members.insert_many(
            [
                {
                    "member_id": "TEST-INACTIVE-NO-ATTENDANCE",
                    "name": "No Attendance",
                    "phone": "9000000001",
                    "status": "active",
                    "joining_date": datetime.combine(
                        today - timedelta(days=10),
                        time.min,
                    ),
                },
                {
                    "member_id": "TEST-INACTIVE-ATTENDED",
                    "name": "Recently Attended",
                    "phone": "9000000002",
                    "status": "active",
                    "joining_date": datetime.combine(
                        today - timedelta(days=20),
                        time.min,
                    ),
                },
            ]
        )

        self.attendance.insert_one(
            {
                "member_id": "TEST-INACTIVE-ATTENDED",
                "attendance_date": datetime.combine(
                    today - timedelta(days=4),
                    time.min,
                ),
                "status": "present",
                "created_at": datetime.utcnow(),
            }
        )

        candidates = {
            candidate["member_id"]: candidate
            for candidate in get_inactive_member_candidates()
        }

        no_attendance = candidates[
            "TEST-INACTIVE-NO-ATTENDANCE"
        ]
        attended = candidates["TEST-INACTIVE-ATTENDED"]

        self.assertIsNone(no_attendance["last_attendance"])
        self.assertEqual(
            no_attendance["days_since_reference"],
            10,
        )
        self.assertEqual(
            attended["last_attendance"],
            (today - timedelta(days=4)).isoformat(),
        )
        self.assertEqual(
            attended["days_since_reference"],
            4,
        )
