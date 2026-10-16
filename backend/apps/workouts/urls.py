
from django.urls import path

from apps.workouts.views import (
    DailyWorkoutGenerateView,
    DailyWorkoutView,
    WorkoutAssignmentView,
    WorkoutHistoryView,
    WorkoutSyncView,
    WorkoutTemplateDetailView,
    WorkoutTemplateListCreateView,
)


urlpatterns = [
    # -----------------------------------------------------------------------
    # Workout Templates
    # -----------------------------------------------------------------------

    path(
        "templates/",
        WorkoutTemplateListCreateView.as_view(),
        name="workout-template-list-create",
    ),

    path(
        "templates/<str:template_id>/",
        WorkoutTemplateDetailView.as_view(),
        name="workout-template-detail",
    ),

    # -----------------------------------------------------------------------
    # Member Workout Assignment
    # -----------------------------------------------------------------------

    path(
        "assignments/",
        WorkoutAssignmentView.as_view(),
        name="workout-assignment-create",
    ),

    path(
        "assignments/<str:member_id>/",
        WorkoutAssignmentView.as_view(),
        name="workout-assignment-detail",
    ),

    # -----------------------------------------------------------------------
    # Daily Workout
    # -----------------------------------------------------------------------

    path(
        "daily/generate/",
        DailyWorkoutGenerateView.as_view(),
        name="daily-workout-generate",
    ),

    path(
        "daily/sync/",
        WorkoutSyncView.as_view(),
        name="daily-workout-sync",
    ),

    path(
        "daily/<str:member_id>/",
        DailyWorkoutView.as_view(),
        name="daily-workout",
    ),

    # -----------------------------------------------------------------------
    # Workout History
    # -----------------------------------------------------------------------

    path(
        "history/<str:member_id>/",
        WorkoutHistoryView.as_view(),
        name="workout-history",
    ),
]

