from django.urls import path

from .views import (
    NoteDetailView,
    NoteListCreateView,
    NoteMemberListView,
)


urlpatterns = [
    path(
        "",
        NoteListCreateView.as_view(),
        name="note-list-create",
    ),
    path(
        "member/<str:member_id>/",
        NoteMemberListView.as_view(),
        name="note-member-list",
    ),
    path(
        "<str:note_id>/",
        NoteDetailView.as_view(),
        name="note-detail",
    ),
]
