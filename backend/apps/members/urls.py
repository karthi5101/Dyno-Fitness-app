
from django.urls import path

from .views import MemberDetailView, MemberListView


urlpatterns = [
    path("", MemberListView.as_view(), name="member-list"),
    path("<str:member_id>/", MemberDetailView.as_view(), name="member-detail"),
]
