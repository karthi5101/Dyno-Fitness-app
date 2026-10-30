"""Database-only file storage helpers.

Uploaded files live in MongoDB GridFS. Domain documents only store
the GridFS file id and descriptive metadata. The browser receives a
short-lived signed URL, never a local filesystem path.
"""

from datetime import datetime
from pathlib import Path
from urllib.parse import quote

import gridfs
from bson import ObjectId
from django.core import signing
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.database.mongodb import MongoDB


MAX_UPLOAD_BYTES = 10 * 1024 * 1024
UPLOAD_TOKEN_MAX_AGE_SECONDS = 300

PAYMENT_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

_EXTENSION_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


def _gridfs():
    return gridfs.GridFS(MongoDB.get_database())


def _detect_content_type(upload):
    declared = (getattr(upload, "content_type", "") or "").lower()

    if declared in _EXTENSION_CONTENT_TYPES.values():
        return declared

    suffix = Path(getattr(upload, "name", "") or "").suffix.lower()

    return _EXTENSION_CONTENT_TYPES.get(suffix, declared)


def _looks_valid(upload, content_type):
    upload.seek(0)
    header = upload.read(16)
    upload.seek(0)

    if content_type == "image/jpeg":
        return header.startswith(b"\xff\xd8\xff")

    if content_type == "image/png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")

    if content_type == "image/webp":
        return (
            header.startswith(b"RIFF")
            and len(header) >= 12
            and header[8:12] == b"WEBP"
        )

    if content_type == "application/pdf":
        return header.startswith(b"%PDF")

    return False


def save_upload(upload, *, allowed_content_types, purpose):
    if upload is None:
        raise ValueError("Choose a file to upload.")

    size = int(getattr(upload, "size", 0) or 0)

    if size <= 0:
        raise ValueError("The uploaded file is empty.")

    if size > MAX_UPLOAD_BYTES:
        raise ValueError("Files must be 10 MB or smaller.")

    content_type = _detect_content_type(upload)

    if content_type not in allowed_content_types:
        raise ValueError(
            "Unsupported file type. Use JPEG, PNG, WebP, or PDF "
            "where permitted."
        )

    if not _looks_valid(upload, content_type):
        raise ValueError("The uploaded file does not match its type.")

    filename = Path(
        getattr(upload, "name", "") or "upload"
    ).name[:200]

    uploaded_at = datetime.utcnow()

    file_id = _gridfs().put(
        upload,
        filename=filename,
        content_type=content_type,
        metadata={
            "purpose": purpose,
            "uploaded_at": uploaded_at,
        },
    )

    return {
        "file_id": str(file_id),
        "filename": filename,
        "content_type": content_type,
        "size": size,
        "uploaded_at": uploaded_at,
    }


def delete_upload(file_id):
    if not file_id or not ObjectId.is_valid(str(file_id)):
        return

    try:
        _gridfs().delete(ObjectId(str(file_id)))
    except Exception:
        # A missing or already-deleted GridFS file is not an error
        # for the domain record being updated.
        pass


def build_upload_token(file_id):
    return signing.TimestampSigner().sign(str(file_id))


def verify_upload_token(token):
    return signing.TimestampSigner().unsign(
        token,
        max_age=UPLOAD_TOKEN_MAX_AGE_SECONDS,
    )


def build_upload_url(file_id, request=None):
    token = quote(build_upload_token(file_id), safe="")
    path = f"/api/uploads/{file_id}/?token={token}"

    if request is not None:
        return request.build_absolute_uri(path)

    return path


def build_upload_payload(file_id, request=None):
    if not file_id:
        return None

    return {
        "file_id": str(file_id),
        "url": build_upload_url(file_id, request),
    }


def metadata_fields(prefix, upload_metadata):
    return {
        f"{prefix}_file_id": upload_metadata["file_id"],
        f"{prefix}_filename": upload_metadata["filename"],
        f"{prefix}_content_type": upload_metadata["content_type"],
        f"{prefix}_size": upload_metadata["size"],
        f"{prefix}_uploaded_at": upload_metadata["uploaded_at"],
    }


def signed_url_from_document(document, prefix, request=None):
    if not document:
        return ""

    file_id = document.get(f"{prefix}_file_id")

    if file_id:
        return build_upload_url(file_id, request)

    return document.get(f"{prefix}_url", "") or ""


class UploadedFileView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, file_id):
        token = request.query_params.get("token", "")

        try:
            signed_file_id = verify_upload_token(token)
        except signing.BadSignature:
            return Response(
                {"detail": "This file link is invalid or has expired."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if signed_file_id != str(file_id) or not ObjectId.is_valid(
            str(file_id)
        ):
            return Response(
                {"detail": "This file link is invalid or has expired."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            grid_out = _gridfs().get(ObjectId(str(file_id)))
        except gridfs.errors.NoFile:
            return Response(
                {"detail": "File not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        content_type = (
            grid_out.content_type
            or "application/octet-stream"
        )
        filename = (
            (grid_out.filename or "upload")
            .replace('"', "")
            .replace("\r", "")
            .replace("\n", "")
        ) or "upload"

        def stream():
            try:
                while True:
                    chunk = grid_out.read(64 * 1024)

                    if not chunk:
                        break

                    yield chunk
            finally:
                grid_out.close()

        response = StreamingHttpResponse(
            stream(),
            content_type=content_type,
        )
        response["Content-Disposition"] = (
            f'inline; filename="{filename}"'
        )
        response["Cache-Control"] = (
            f"private, max-age={UPLOAD_TOKEN_MAX_AGE_SECONDS}"
        )
        response["X-Content-Type-Options"] = "nosniff"

        return response
