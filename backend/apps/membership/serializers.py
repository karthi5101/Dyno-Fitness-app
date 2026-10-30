from datetime import datetime

from rest_framework import serializers


class MembershipSerializer(serializers.Serializer):
    member_id = serializers.CharField(
        max_length=50
    )

    plan_name = serializers.ChoiceField(
        choices=[
            ("Monthly", "Monthly"),
            ("Quarterly", "Quarterly"),
            ("6 Months", "6 Months"),
            ("12 Months", "12 Months"),
        ]
    )

    start_date = serializers.DateField()

    end_date = serializers.DateField()

    status = serializers.CharField(
        max_length=30,
        required=False,
        default="active",
    )

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")

        if (
            start_date is not None
            and end_date is not None
            and end_date < start_date
        ):
            raise serializers.ValidationError(
                {
                    "end_date": (
                        "End date must be on or after the start date."
                    )
                }
            )

        return attrs

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