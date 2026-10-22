from datetime import date, datetime, timezone

from rest_framework import serializers


def serialize_timestamp(value):
    """
    Serialize a stored timestamp.

    MongoDB returns naive datetimes in UTC. They are
    tagged as UTC so that clients can convert them to
    their own local time without guessing.
    """

    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(
                tzinfo=timezone.utc,
            )

        return value.isoformat()

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


class AttendanceDateField(serializers.DateField):
    """
    A calendar date field that also accepts the datetime
    values MongoDB returns for stored attendance dates.

    DRF refuses to coerce a datetime into a date, so the
    stored value is converted here instead of raising an
    assertion error.
    """

    def to_representation(self, value):
        if isinstance(value, datetime):
            return value.date().isoformat()

        if isinstance(value, date):
            return value.isoformat()

        return super().to_representation(value)


class AttendanceSerializer(serializers.Serializer):
    id = serializers.SerializerMethodField()
    _id = serializers.SerializerMethodField()
    attendance_id = serializers.SerializerMethodField()
    member_id = serializers.CharField(max_length=20)
    attendance_date = AttendanceDateField(
        required=False,
        allow_null=True,
    )
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

    def get_id(self, obj):
        _id = obj.get("_id") or obj.get("id")
        if _id is None:
            return None
        return str(_id)

    def get__id(self, obj):
        _id = obj.get("_id") or obj.get("id")
        if _id is None:
            return None
        return str(_id)

    def get_attendance_id(self, obj):
        _id = obj.get("_id") or obj.get("id") or obj.get("attendance_id")
        if _id is None:
            return None
        return str(_id)

    def to_representation(self, instance):
        data = super().to_representation(instance)

        data["check_in_time"] = serialize_timestamp(
            instance.get("check_in_time"),
        )

        return data


class AttendanceScanSerializer(serializers.Serializer):
    member_id = serializers.CharField(max_length=20)
