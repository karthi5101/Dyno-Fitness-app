from django.urls import path

from .views import (
    ProgramArchiveView,
    ProgramDetailView,
    ProgramDuplicateView,
    ProgramListCreateView,
)

urlpatterns = [
    path("", ProgramListCreateView.as_view(), name="program-list"),
    path(
        "<str:program_id>/",
        ProgramDetailView.as_view(),
        name="program-detail",
    ),
    path(
        "<str:program_id>/duplicate/",
        ProgramDuplicateView.as_view(),
        name="program-duplicate",
    ),
    path(
        "<str:program_id>/archive/",
        ProgramArchiveView.as_view(),
        name="program-archive",
    ),
]
