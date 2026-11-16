from django.urls import include, path

from .views import TrainingHealthView

urlpatterns = [
    path("health/", TrainingHealthView.as_view(), name="training-health"),
    path(
        "",
        include("apps.training.library.urls"),
    ),
    path(
        "programs/",
        include("apps.training.programs.urls"),
    ),
    path(
        "",
        include("apps.training.assignments.urls"),
    ),
    path(
        "",
        include("apps.training.sessions.urls"),
    ),
]