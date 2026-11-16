from django.db import models


TRN_ASSIGNMENT_CHOICES = (
    ("rotation", "rotation"),
    ("fixed_week", "fixed week"),
)


class TrnAssignment(models.Model):
    """One active assignment per member (partial unique index on member_id + status=active)."""

    member = models.ForeignKey(
        "members.Member",
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    program = models.ForeignKey(
        "training.Program",
        on_delete=models.CASCADE,
        related_name="assignments_copy",
    )
    mode = models.CharField(max_length=20, choices=TRN_ASSIGNMENT_CHOICES, default="rotation")
    weekday_map = models.JSONField(null=True, blank=True)
    pointer = models.IntegerField(null=True, blank=True)
    start_date = models.DateField()
    program_copy = models.TextField()  # deep copy of program name and days as JSON
    program_source_name = models.CharField(max_length=200)
    revision = models.IntegerField(default=0)
    status = models.CharField(max_length=20, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # One active assignment per member (partial unique index handled by migration/index)
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.program_source_name} assignment for {self.member}"


class TrnAssignmentHistory(models.Model):
    """History log for assignment edits."""

    assignment = models.ForeignKey(
        TrnAssignment, on_delete=models.CASCADE, related_name="history"
    )
    changed_by = models.CharField(max_length=100)
    changed_at = models.DateTimeField(auto_now_add=True)
    change_type = models.CharField(max_length=20)  # "mode", "pointer", "mode+pointer"
    old_value = models.TextField(null=True, blank=True)
    new_value = models.TextField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-changed_at"]


class TrnSession(models.Model):
    """Logged sessions for assignment mode."""

    assignment = models.ForeignKey(
        TrnAssignment, on_delete=models.CASCADE, related_name="sessions"
    )
    session_date = models.DateField()
    day_key = models.CharField(max_length=20)
    day_index = models.IntegerField()
    exercises = models.JSONField(default=dict)
    status = models.CharField(max_length=20, default="active")
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    advanced = models.BooleanField(default=False)
    corrections = models.JSONField(default=dict, blank=True)

    class Meta:
        # Unique on (member_id, session_date) partial
        unique_together = ("assignment", "session_date")
        ordering = ["-session_date"]

    def __str__(self):
        return f"Session {self.session_date} - {self.day_key}"