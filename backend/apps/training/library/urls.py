from django.urls import path

from .views import (
    ExerciseDetailView,
    ExerciseListCreateView,
    ExerciseMediaView,
)


urlpatterns = [
    path(
        "exercises/",
        ExerciseListCreateView.as_view(),
        name="training-exercise-list-create",
    ),
    path(
        "exercises/<str:exercise_id>/",
        ExerciseDetailView.as_view(),
        name="training-exercise-detail",
    ),
    path(
        "media/exercises/<str:slug>/<int:n>/",
        ExerciseMediaView.as_view(),
        name="training-exercise-media",
    ),
]
