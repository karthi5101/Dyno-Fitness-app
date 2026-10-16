from django.urls import path

from apps.attendance.views import (
    AttendanceDetailView,
    AttendanceListCreateView,
    AttendanceMemberListView,
    AttendanceScanView,
    AttendanceTodayView,
)

from apps.attendance.views_qr import (
    AuthenticatedAttendanceScanView,
    GymQRView,
)


urlpatterns = [
    path(
        "",
        AttendanceListCreateView.as_view(),
        name="attendance-list-create",
    ),
    path(
        "scan/",
        AttendanceScanView.as_view(),
        name="attendance-scan",
    ),
    path(
        "qr/",
        GymQRView.as_view(),
        name="attendance-qr",
    ),
    path(
        "qr-scan/",
        AuthenticatedAttendanceScanView.as_view(),
        name="attendance-qr-scan",
    ),
    path(
        "today/",
        AttendanceTodayView.as_view(),
        name="attendance-today",
    ),
    path(
        "member/<str:member_id>/",
        AttendanceMemberListView.as_view(),
        name="attendance-member-list",
    ),
    path(
        "<str:attendance_id>/",
        AttendanceDetailView.as_view(),
        name="attendance-detail",
    ),
]