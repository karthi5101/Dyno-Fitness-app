from django.urls import path

from .views import (
    CorrectionsView,
    HistoryView,
    LastExerciseView,
    PlanView,
    SessionCompleteView,
    SessionDetailView,
    SessionSetsView,
    SessionStartView,
    StaffAdherenceView,
    StaffHistoryView,
    StaffPlanView,
    TodayView,
)


urlpatterns = [
    path("me/today/", TodayView.as_view(), name="member-today"),
    path("me/plan/", PlanView.as_view(), name="member-plan"),
    path("me/history/", HistoryView.as_view(), name="member-history"),
    path("me/exercises/<str:exercise_id>/last/", LastExerciseView.as_view(), name="member-exercise-last"),
    path("sessions/start/", SessionStartView.as_view(), name="session-start"),
    path("sessions/<str:session_id>/", SessionDetailView.as_view(), name="session-detail"),
    path("sessions/<str:session_id>/complete/", SessionCompleteView.as_view(), name="session-complete"),
    path("sessions/<str:session_id>/sets/", SessionSetsView.as_view(), name="session-sets"),
    path("sessions/<str:session_id>/corrections/", CorrectionsView.as_view(), name="session-corrections"),
    path("staff/members/<str:member_id>/history/", StaffHistoryView.as_view(), name="staff-member-history"),
    path("staff/members/<str:member_id>/adherence/", StaffAdherenceView.as_view(), name="staff-member-adherence"),
    path("staff/members/<str:member_id>/plan/", StaffPlanView.as_view(), name="staff-member-plan"),
]