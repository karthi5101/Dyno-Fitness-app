from datetime import datetime, timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.attendance.repositories import (
    create_attendance,
    create_scan_attendance,
    delete_attendance,
    get_attendance_by_id,
    get_attendance_by_member,
    get_attendance_list,
    get_today_attendance,
    update_attendance,
)

from apps.authentication.permissions import (
    IsStaffUser,
    MemberScopedAccess,
)
from apps.attendance.serializers import (
    AttendanceScanSerializer,
    AttendanceSerializer,
)


def serialize_datetime(value):
    """
    Serialize a stored timestamp.

    MongoDB returns naive datetimes in UTC. They are
    tagged as UTC so that clients can convert them to
    their own local time without guessing.
    """

    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(
                tzinfo=timezone.utc,
            )

        return value.isoformat()

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def serialize_date(value):
    """
    Serialize a stored calendar date.

    Attendance dates are calendar days, not instants,
    so they are returned as plain ISO dates.
    """

    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date().isoformat()

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def serialize_document(document):
    if not document:
        return None

    return {
        "id": str(document["_id"]),
        "member_id": document["member_id"],
        "attendance_date": serialize_date(
            document["attendance_date"],
        ),
        "check_in_time": serialize_datetime(
            document.get("check_in_time"),
        ),
        "status": document["status"],
        "notes": document.get("notes"),
        "created_at": serialize_datetime(
            document.get("created_at"),
        ),
        "updated_at": serialize_datetime(
            document.get("updated_at"),
        ),
    }


class AttendanceListCreateView(APIView):

    permission_classes = [IsStaffUser]

    def get(self, request):
        records = get_attendance_list()

        return Response(
            [serialize_document(record) for record in records],
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = AttendanceSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            record = create_attendance(
                serializer.validated_data
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            serialize_document(record),
            status=status.HTTP_201_CREATED,
        )


class AttendanceScanView(APIView):

    permission_classes = [IsStaffUser]

    def post(self, request):
        serializer = AttendanceScanSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        member_id = serializer.validated_data["member_id"]

        try:
            record = create_scan_attendance(
                member_id
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "detail": "Attendance marked successfully.",
                "attendance": serialize_document(record),
            },
            status=status.HTTP_201_CREATED,
        )


class AttendanceTodayView(APIView):

    permission_classes = [IsStaffUser]

    def get(self, request):
        records = get_today_attendance()

        return Response(
            [serialize_document(record) for record in records],
            status=status.HTTP_200_OK,
        )


class AttendanceMemberListView(APIView):

    permission_classes = [MemberScopedAccess]

    def get(self, request, member_id):
        records = get_attendance_by_member(
            member_id
        )

        return Response(
            [serialize_document(record) for record in records],
            status=status.HTTP_200_OK,
        )


class AttendanceDetailView(APIView):

    permission_classes = [IsStaffUser]

    def get(self, request, attendance_id):
        record = get_attendance_by_id(
            attendance_id
        )

        if record is None:
            return Response(
                {
                    "detail": "Attendance record not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_document(record),
            status=status.HTTP_200_OK,
        )

    def put(self, request, attendance_id):
        serializer = AttendanceSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            record = update_attendance(
                attendance_id,
                serializer.validated_data,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if record is None:
            return Response(
                {
                    "detail": "Attendance record not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            serialize_document(record),
            status=status.HTTP_200_OK,
        )

    def delete(self, request, attendance_id):
        deleted = delete_attendance(
            attendance_id
        )

        if not deleted:
            return Response(
                {
                    "detail": "Attendance record not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )