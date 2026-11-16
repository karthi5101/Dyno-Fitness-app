from django.urls import include, path

from .views import TrainingHealthView

urlpatterns = [
    path("health/", TrainingHealthView.as_view(), name="training-health"),
    path(
        "",
        include("apps.workouts.library.urls"),
    ),
    path(
        "programs/",
        include("apps.workouts.programs.urls"),
    ),
    path(
        "",
        include("apps.workouts.assignments.urls"),
    ),
    path(
        "",
        include("apps.workouts.sessions.urls"),
    ),
]