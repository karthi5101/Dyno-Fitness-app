from django.urls import include, path

from api.views import HealthCheckView


urlpatterns = [
    path(
        "health/",
        HealthCheckView.as_view(),
        name="health",
    ),
    path(
        "auth/",
        include("apps.authentication.urls"),
    ),
    path(
        "members/",
        include("apps.members.urls"),
    ),
    path(
        "attendance/",
        include("apps.attendance.urls"),
    ),
    path(
        "sessions/",
        include("apps.gym_sessions.urls"),
    ),
    path(
        "workouts/",
        include("apps.workouts.urls"),
    ),
    path(
        "diets/",
        include("apps.diets.urls"),
    ),
    path(
        "transformations/",
        include("apps.transformations.urls"),
    ),
    path(
        "inactive-members/",
        include("apps.inactive_members.urls"),
    ),
    path(
        "membership/",
        include("apps.membership.urls"),
    ),
    path(
        "dashboard/",
        include("apps.dashboard.urls"),
    ),
    path(
        "notes/",
        include("apps.notes.urls"),
    ),
]