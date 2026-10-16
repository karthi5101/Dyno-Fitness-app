from django.urls import path

from apps.diets.views import (
    DietAssignmentListCreateView,
    DietTemplateListCreateView,
)


urlpatterns = [
    path(
        "templates/",
        DietTemplateListCreateView.as_view(),
        name="diet-template-list-create",
    ),
    path(
        "assignments/",
        DietAssignmentListCreateView.as_view(),
        name="diet-assignment-list-create",
    ),
]