from django.urls import path

from .views import (
    SessionClientTodayView,
    SessionTodayView,
    SessionTomorrowView,
    SessionTrainerTodayView,
)


urlpatterns = [
    path(
        "today/",
        SessionTodayView.as_view(),
        name="session-today",
    ),
    path(
        "tomorrow/",
        SessionTomorrowView.as_view(),
        name="session-tomorrow",
    ),
    path(
        "client/today/",
        SessionClientTodayView.as_view(),
        name="session-client-today",
    ),
    path(
        "trainer/today/",
        SessionTrainerTodayView.as_view(),
        name="session-trainer-today",
    ),
]