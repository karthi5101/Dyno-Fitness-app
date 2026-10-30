from django.urls import path

from apps.transformations.views import (
    TransformationDetailView,
    TransformationImageUploadView,
    TransformationListCreateView,
    TransformationMemberListView,
)


urlpatterns = [
    path(
        "",
        TransformationListCreateView.as_view(),
        name="transformation-list-create",
    ),
    path(
        "record/<str:transformation_id>/image/",
        TransformationImageUploadView.as_view(),
        name="transformation-image-upload",
    ),
    path(
        "record/<str:transformation_id>/",
        TransformationDetailView.as_view(),
        name="transformation-detail",
    ),
    path(
        "<str:member_id>/",
        TransformationMemberListView.as_view(),
        name="transformation-member-list",
    ),
]