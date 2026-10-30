"""Transformation image upload tests for the isolated test DB."""

import os
import unittest
from datetime import date
from urllib.parse import urlsplit

from bson import ObjectId
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.members.database import get_members_collection
from apps.transformations.database import (
    get_transformations_collection,
)
from apps.uploads import delete_upload

TEST_PREFIX = "TEST-TRANSFORM-"
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
            "Set MONGODB_DATABASE=dyno_fitness_test to run "
            "transformation tests."
        )


def delete_test_transformations():
    collection = get_transformations_collection()

    for document in collection.find(
        {"member_id": TEST_MEMBER}
    ):
        for prefix in (
            "image",
            "front_image",
            "back_image",
        ):
            delete_upload(
                document.get(f"{prefix}_file_id")
            )

    collection.delete_many(
        {"member_id": TEST_MEMBER}
    )


class TransformationUploadTests(TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_test_database()
        super().setUpClass()

        cls.staff = User.objects.create_user(
            username=TEST_STAFF,
            password=STRONG_PASSWORD,
            is_staff=True,
        )
        get_members_collection().delete_many(
            {"member_id": TEST_MEMBER}
        )
        get_members_collection().insert_one(
            {
                "member_id": TEST_MEMBER,
                "name": "Transformation Test Member",
                "phone": "9000000000",
                "status": "active",
            }
        )

    @classmethod
    def tearDownClass(cls):
        get_members_collection().delete_many(
            {"member_id": TEST_MEMBER}
        )
        delete_test_transformations()
        User.objects.filter(
            username__startswith=TEST_PREFIX
        ).delete()

        super().tearDownClass()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

        delete_test_transformations()

    def create_transformation(self):
        return self.client.post(
            "/api/transformations/",
            {
                "member_id": TEST_MEMBER,
                "week_number": 1,
                "recorded_date": date.today().isoformat(),
                "weight_kg": "72.50",
                "notes": "Test transformation",
            },
            format="json",
        )

    def test_image_upload_stores_gridfs_metadata_and_signed_url(self):
        created = self.create_transformation()
        self.assertEqual(created.status_code, 201)

        transformation_id = created.data["id"]
        upload = self.client.post(
            f"/api/transformations/record/{transformation_id}/image/",
            {
                "slot": "image",
                "file": SimpleUploadedFile(
                    "progress.png",
                    PNG_BYTES,
                    content_type="image/png",
                ),
            },
            format="multipart",
        )

        self.assertEqual(upload.status_code, 200)
        self.assertIn("/api/uploads/", upload.data["image_url"])

        stored = get_transformations_collection().find_one(
            {"_id": ObjectId(transformation_id)}
        )
        self.assertTrue(stored["image_file_id"])
        self.assertEqual(stored["image_content_type"], "image/png")

        parsed = urlsplit(upload.data["image_url"])
        fetched = APIClient().get(
            f"{parsed.path}?{parsed.query}"
        )
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(
            b"".join(fetched.streaming_content),
            PNG_BYTES,
        )

        tampered = APIClient().get(
            f"{parsed.path}?token=bad-token"
        )
        self.assertEqual(tampered.status_code, 403)

    def test_image_upload_rejects_unsupported_file(self):
        created = self.create_transformation()
        self.assertEqual(created.status_code, 201)

        response = self.client.post(
            f"/api/transformations/record/{created.data['id']}/image/",
            {
                "file": SimpleUploadedFile(
                    "progress.txt",
                    b"not an image",
                    content_type="text/plain",
                )
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)

    def test_deleting_transformation_removes_gridfs_file(self):
        created = self.create_transformation()
        transformation_id = created.data["id"]

        self.client.post(
            f"/api/transformations/record/{transformation_id}/image/",
            {
                "file": SimpleUploadedFile(
                    "progress.png",
                    PNG_BYTES,
                    content_type="image/png",
                )
            },
            format="multipart",
        )

        stored = get_transformations_collection().find_one(
            {"_id": ObjectId(transformation_id)}
        )
        file_id = stored["image_file_id"]

        deleted = self.client.delete(
            f"/api/transformations/record/{transformation_id}/"
        )
        self.assertEqual(deleted.status_code, 204)

        from apps.uploads import _gridfs  # noqa: PLC0415

        self.assertFalse(
            _gridfs().exists(ObjectId(file_id))
        )
