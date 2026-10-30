"""Membership and payment-proof API tests for the isolated test DB."""

import os
import unittest
from datetime import date
from urllib.parse import urlsplit

import gridfs
from bson import ObjectId
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.authentication.models import UserMemberProfile
from apps.members.database import get_members_collection
from apps.membership.payment_database import (
    get_payments_collection,
)
from apps.membership.payment_repository import get_payment_by_id
from apps.uploads import delete_upload
from core.database.mongodb import MongoDB

TEST_PREFIX = "TEST-MEMBERSHIP-"
TEST_MEMBER = TEST_PREFIX + "MEMBER"
TEST_STAFF = TEST_PREFIX + "STAFF"
STRONG_PASSWORD = "DynoStrong!2026"

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)

User = get_user_model()


def ensure_test_database():
    if os.getenv("MONGODB_DATABASE") != "dyno_fitness_test":
        raise unittest.SkipTest(
            "Set MONGODB_DATABASE=dyno_fitness_test to run membership tests."
        )


def delete_test_payments():
    payments = get_payments_collection().find(
        {"member_id": TEST_MEMBER}
    )

    for payment in payments:
        delete_upload(
            payment.get("payment_proof_file_id")
        )

    get_payments_collection().delete_many(
        {"member_id": TEST_MEMBER}
    )


class MembershipAndPaymentTests(TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_test_database()
        super().setUpClass()

        cls.staff = User.objects.create_user(
            username=TEST_STAFF,
            password=STRONG_PASSWORD,
            is_staff=True,
        )
        cls.member = User.objects.create_user(
            username=TEST_MEMBER,
            password=STRONG_PASSWORD,
        )
        UserMemberProfile.objects.create(
            user=cls.member,
            member_id=TEST_MEMBER,
        )
        get_members_collection().delete_many(
            {"member_id": TEST_MEMBER}
        )
        get_members_collection().insert_one(
            {
                "member_id": TEST_MEMBER,
                "name": "Membership Test Member",
                "phone": "9000000000",
                "status": "active",
            }
        )

    @classmethod
    def tearDownClass(cls):
        get_members_collection().delete_many(
            {"member_id": TEST_MEMBER}
        )
        delete_test_payments()
        User.objects.filter(
            username__startswith=TEST_PREFIX
        ).delete()

        super().tearDownClass()

    def setUp(self):
        from apps.membership.database import (  # noqa: PLC0415
            get_memberships_collection,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

        self.memberships = get_memberships_collection()
        self.memberships.delete_many(
            {"member_id": TEST_MEMBER}
        )
        delete_test_payments()

    def create_membership(self, **overrides):
        payload = {
            "member_id": TEST_MEMBER,
            "plan_name": "Monthly",
            "start_date": "2026-01-01",
            "end_date": "2026-02-01",
            "status": "active",
        }
        payload.update(overrides)

        return self.client.post(
            "/api/membership/",
            payload,
            format="json",
        )

    def test_membership_plan_dates_and_duplicate_validation(self):
        created = self.create_membership()
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["plan_name"], "Monthly")

        duplicate = self.create_membership()
        self.assertEqual(duplicate.status_code, 409)

        invalid_plan = self.create_membership(
            plan_name="Weekly"
        )
        self.assertEqual(invalid_plan.status_code, 400)

        invalid_dates = self.create_membership(
            end_date="2025-12-01"
        )
        self.assertEqual(invalid_dates.status_code, 400)

    def test_membership_dates_can_be_edited_and_persist(self):
        self.assertEqual(
            self.create_membership().status_code,
            201,
        )

        response = self.client.patch(
            f"/api/membership/{TEST_MEMBER}/",
            {
                "plan_name": "Quarterly",
                "start_date": "2026-02-01",
                "end_date": "2026-05-01",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["plan_name"], "Quarterly")
        self.assertEqual(
            response.data["end_date"],
            "2026-05-01",
        )

        stored = self.memberships.find_one(
            {"member_id": TEST_MEMBER}
        )
        self.assertEqual(
            stored["end_date"].date().isoformat(),
            "2026-05-01",
        )

    def test_payment_proof_is_stored_in_gridfs_and_signed_url_works(self):
        created = self.client.post(
            "/api/membership/payments/",
            {
                "member_id": TEST_MEMBER,
                "amount": "2500.00",
                "payment_date": date.today().isoformat(),
                "payment_method": "UPI",
                "period_start": "2026-01-01",
                "period_end": "2026-02-01",
                "notes": "Test payment",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)

        payment_id = created.data["id"]
        upload = self.client.post(
            f"/api/membership/payments/{payment_id}/proof/",
            {
                "file": SimpleUploadedFile(
                    "proof.png",
                    PNG_BYTES,
                    content_type="image/png",
                )
            },
            format="multipart",
        )

        self.assertEqual(upload.status_code, 200)
        self.assertIsNotNone(upload.data["payment_proof"])

        stored = get_payment_by_id(payment_id)
        self.assertTrue(stored["payment_proof_file_id"])

        proof_url = upload.data["payment_proof"]["url"]
        parsed = urlsplit(proof_url)
        fetched = APIClient().get(
            f"{parsed.path}?{parsed.query}"
        )

        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(
            b"".join(fetched.streaming_content),
            PNG_BYTES,
        )

        invalid = APIClient().get(
            f"{parsed.path}?token=invalid"
        )
        self.assertEqual(invalid.status_code, 403)

    def test_payment_proof_rejects_unsupported_file(self):
        created = self.client.post(
            "/api/membership/payments/",
            {
                "member_id": TEST_MEMBER,
                "amount": "100.00",
                "payment_date": date.today().isoformat(),
                "payment_method": "Cash",
                "period_start": "2026-01-01",
                "period_end": "2026-02-01",
            },
            format="json",
        )

        response = self.client.post(
            f"/api/membership/payments/{created.data['id']}/proof/",
            {
                "file": SimpleUploadedFile(
                    "proof.txt",
                    b"not an image",
                    content_type="text/plain",
                )
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)

    def test_payment_delete_removes_gridfs_proof(self):
        created = self.client.post(
            "/api/membership/payments/",
            {
                "member_id": TEST_MEMBER,
                "amount": "150.00",
                "payment_date": date.today().isoformat(),
                "payment_method": "Cash",
                "period_start": "2026-01-01",
                "period_end": "2026-02-01",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)

        payment_id = created.data["id"]
        upload = self.client.post(
            f"/api/membership/payments/{payment_id}/proof/",
            {
                "file": SimpleUploadedFile(
                    "delete-proof.png",
                    PNG_BYTES,
                    content_type="image/png",
                )
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, 200)

        file_id = get_payment_by_id(payment_id)[
            "payment_proof_file_id"
        ]
        self.addCleanup(delete_upload, file_id)

        grid = gridfs.GridFS(MongoDB.get_database())
        self.assertTrue(
            grid.exists(ObjectId(file_id))
        )

        deleted = self.client.delete(
            f"/api/membership/payments/{payment_id}/"
        )
        self.assertEqual(deleted.status_code, 204)
        self.assertIsNone(get_payment_by_id(payment_id))
        self.assertFalse(
            grid.exists(ObjectId(file_id))
        )

    def test_payment_proof_rejects_oversized_file(self):
        created = self.client.post(
            "/api/membership/payments/",
            {
                "member_id": TEST_MEMBER,
                "amount": "50.00",
                "payment_date": date.today().isoformat(),
                "payment_method": "Cash",
                "period_start": "2026-01-01",
                "period_end": "2026-02-01",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)

        oversized = b"\x89PNG\r\n\x1a\n" + (
            b"\x00" * (10 * 1024 * 1024)
        )

        response = self.client.post(
            f"/api/membership/payments/{created.data['id']}/proof/",
            {
                "file": SimpleUploadedFile(
                    "large.png",
                    oversized,
                    content_type="image/png",
                )
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("file", response.data)

    def test_member_can_read_own_payments_but_not_another_member(self):
        created = self.client.post(
            "/api/membership/payments/",
            {
                "member_id": TEST_MEMBER,
                "amount": "75.00",
                "payment_date": date.today().isoformat(),
                "payment_method": "Cash",
                "period_start": "2026-01-01",
                "period_end": "2026-02-01",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)

        member_client = APIClient()
        member_client.force_authenticate(user=self.member)

        own = member_client.get(
            f"/api/membership/payments/member/{TEST_MEMBER}/"
        )
        self.assertEqual(own.status_code, 200)
        self.assertEqual(len(own.data), 1)

        other = member_client.get(
            f"/api/membership/payments/member/{TEST_PREFIX}OTHER/"
        )
        self.assertEqual(other.status_code, 403)

        upload = member_client.post(
            f"/api/membership/payments/{created.data['id']}/proof/",
            {
                "file": SimpleUploadedFile(
                    "member-proof.png",
                    PNG_BYTES,
                    content_type="image/png",
                )
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, 403)
