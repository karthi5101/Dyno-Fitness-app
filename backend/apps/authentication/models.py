from django.conf import settings
from django.db import models


class UserMemberProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="member_profile",
    )
    member_id = models.CharField(
        max_length=50,
        unique=True,
    )

    def __str__(self):
        return f"{self.user.username} -> {self.member_id}"