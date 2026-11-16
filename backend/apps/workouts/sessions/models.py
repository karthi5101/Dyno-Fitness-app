from django.db import models


TRN_SESSION_STATUS_CHOICES = (
    ("active", "active"),
    ("completed", "completed"),
    ("abandoned", "abandoned"),
)


class TrnSession(models.Model):
    """Logged sessions for assignment mode.

    One session per (member, day) in assignment rotation or fixed week.
    """

    assignment = models.ForeignKey(
        "training.TrnAssignment",
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    day_key = models.CharField(max_length=20)
    day_index = models.IntegerField()
    exercises = models.JSONField(default=dict)
    status = models.CharField(
        max_length=20, choices=TRN_SESSION_STATUS_CHOICES, default="active"
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    advanced = models.BooleanField(default=False)
    corrections = models.JSONField(default=dict, blank=True)

    class Meta:
        # One session per (member, day_key) within an assignment
        unique_together = ("assignment", "day_key")
        ordering = ["-started_at"]

    def __str__(self):
        return f"Session {self.day_key} - {self.assignment.program_source_name}"