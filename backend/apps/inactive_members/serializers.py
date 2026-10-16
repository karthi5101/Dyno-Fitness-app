from rest_framework import serializers


class InactiveMemberSerializer(serializers.Serializer):
    member_id = serializers.CharField()
    name = serializers.CharField()
    phone = serializers.CharField()
    status = serializers.CharField()
    last_attendance_date = serializers.DateField()
    days_since_attendance = serializers.IntegerField()
    inactive_threshold_days = serializers.IntegerField()