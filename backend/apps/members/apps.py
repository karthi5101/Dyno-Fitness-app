from django.apps import AppConfig


class MembersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.members"

    def ready(self):
        from .indexes import ensure_member_indexes

        ensure_member_indexes()