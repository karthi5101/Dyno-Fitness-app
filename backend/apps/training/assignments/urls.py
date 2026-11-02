from django.urls import path

from .views import (
    MemberAdherenceView,
    MemberAssignmentEndView,
    MemberAssignmentView,
    MemberHistoryView,
)

urlpatterns = [
    path(
        "members/<str:member_id>/assignment/end/",
        MemberAssignmentEndView.as_view(),
        name="member-assignment-end",
    ),
    path(
        "members/<str:member_id>/assignment/",
        MemberAssignmentView.as_view(),
        name="member-assignment",
    ),
    path(
        "members/<str:member_id>/history/",
        MemberHistoryView.as_view(),
        name="member-training-history",
    ),
    path(
        "members/<str:member_id>/adherence/",
        MemberAdherenceView.as_view(),
        name="member-training-adherence",
    ),
]
