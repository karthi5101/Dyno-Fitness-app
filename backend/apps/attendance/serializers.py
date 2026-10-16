from rest_framework import serializers


class AttendanceSerializer(serializers.Serializer):
    member_id = serializers.CharField(max_length=20)
    attendance_date = serializers.DateField()
    check_in_time = serializers.DateTimeField(
        required=False,
        allow_null=True,
    )
    status = serializers.ChoiceField(
        choices=["present", "absent"],
        default="present",
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )


class AttendanceScanSerializer(serializers.Serializer):
    member_id = serializers.CharField(max_length=20)