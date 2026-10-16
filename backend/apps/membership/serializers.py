from datetime import datetime

from rest_framework import serializers


class MembershipSerializer(serializers.Serializer):
    member_id = serializers.CharField(
        max_length=50
    )

    plan_name = serializers.CharField(
        max_length=100
    )

    start_date = serializers.DateField()

    end_date = serializers.DateField()

    status = serializers.CharField(
        max_length=30,
        required=False,
        default="active",
    )

    def to_representation(self, instance):
        data = dict(instance)

        for field in (
            "start_date",
            "end_date",
        ):
            value = data.get(field)

            if isinstance(value, datetime):
                data[field] = value.date()

        data.pop("_id", None)
        data.pop("created_at", None)
        data.pop("updated_at", None)

        return super().to_representation(data)