from django.urls import path

from apps.membership.payment_views import (
    PaymentDetailView,
    PaymentListCreateView,
    PaymentMemberListView,
)
from apps.membership.views import (
    MembershipDetailView,
    MembershipListCreateView,
)


urlpatterns = [
    path(
        "",
        MembershipListCreateView.as_view(),
        name="membership-list-create",
    ),
    path(
        "payments/",
        PaymentListCreateView.as_view(),
        name="payment-list-create",
    ),
    path(
        "payments/member/<str:member_id>/",
        PaymentMemberListView.as_view(),
        name="payment-member-list",
    ),
    path(
        "payments/<str:payment_id>/",
        PaymentDetailView.as_view(),
        name="payment-detail",
    ),
    path(
        "<str:member_id>/",
        MembershipDetailView.as_view(),
        name="membership-detail",
    ),
]