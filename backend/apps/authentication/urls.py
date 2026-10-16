
from django.urls import path

from .password_views import (
    ChangePasswordView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
)
from .views import LoginView
from .views_identity import CurrentIdentityView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("me/", CurrentIdentityView.as_view(), name="current-identity"),
    path(
        "member-identity/",
        CurrentIdentityView.as_view(),
        name="member-identity",
    ),
    path(
        "password/change/",
        ChangePasswordView.as_view(),
        name="change-password",
    ),
    path(
        "password/reset/",
        PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "password/reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
]
