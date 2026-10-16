from django.urls import path

from apps.inactive_members.views import (
    InactiveMemberListView,
)


urlpatterns = [
    path(
        "",
        InactiveMemberListView.as_view(),
        name="inactive-member-list",
    ),
]