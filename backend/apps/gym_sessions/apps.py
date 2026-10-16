from django.apps import AppConfig


class GymSessionsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.gym_sessions"
    label = "gym_sessions"
    verbose_name = "Gym Sessions"