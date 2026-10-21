from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.identity import get_member_id_for_user
from apps.authentication.permissions import IsStaffUser

from .qr import (
    generate_daily_qr_token,
    validate_daily_qr_token,
)
from .repositories import create_scan_attendance
from .serializers import AttendanceSerializer
from .serializers_qr import AttendanceQRScanSerializer


class GymQRView(APIView):
    """
    Return the common QR token for the current gym day.

    Staff-only endpoint.
    """

    permission_classes = [IsStaffUser]

    def get(self, request):
        return Response(
            {
                "qr_token": generate_daily_qr_token(),
                "date": str(
                    timezone.localdate()
                ),
            }
        )


class AuthenticatedAttendanceScanView(APIView):
    """
    Check in the authenticated member using the
    common gym QR token.

    The member identity comes from the JWT and is
    never accepted from the request body.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AttendanceQRScanSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        qr_token = serializer.validated_data[
            "qr_token"
        ]

        if not validate_daily_qr_token(
            qr_token,
        ):
            return Response(
                {
                    "detail": (
                        "Invalid or expired gym QR code."
                    ),
                },
                status=400,
            )

        member_id = get_member_id_for_user(
            request.user,
        )

        if member_id is None:
            return Response(
                {
                    "detail": (
                        "This account is not linked "
                        "to a Dyno member."
                    ),
                },
                status=403,
            )

        try:
            attendance = create_scan_attendance(
                member_id,
            )
        except ValueError as error:
            return Response(
                {
                    "detail": str(error),
                },
                status=400,
            )

        attendance_data = AttendanceSerializer(
            attendance,
        ).data

        return Response(
            {
                "detail": (
                    "Attendance marked successfully."
                ),
                "member_id": member_id,
                "attendance": attendance_data,
            },
            status=201,
        )