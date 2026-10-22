
from datetime import datetime

from rest_framework import serializers


class PaymentSerializer(serializers.Serializer):
    id = serializers.SerializerMethodField()

    member_id = serializers.CharField(
        max_length=50
    )

    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=0,
    )

    payment_date = serializers.DateField()

    payment_method = serializers.CharField(
        max_length=30
    )

    period_start = serializers.DateField()

    period_end = serializers.DateField()

    notes = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def get_id(self, obj):
        payment_id = obj.get("id") or obj.get("_id")

        if payment_id is None:
            return None

        return str(payment_id)

    def validate(self, attrs):
        period_start = attrs.get("period_start")
        period_end = attrs.get("period_end")

        if (
            period_start is not None
            and period_end is not None
            and period_end < period_start
        ):
            raise serializers.ValidationError(
                {
                    "period_end": (
                        "Period end date cannot be before "
                        "period start date."
                    )
                }
            )

        return attrs

    def to_representation(self, instance):
        data = dict(instance)

        for field in (
            "payment_date",
            "period_start",
            "period_end",
        ):
            value = data.get(field)

            if isinstance(value, datetime):
                data[field] = value.date()

        if data.get("_id") is not None:
            data["id"] = str(data["_id"])

        data.pop("_id", None)
        data.pop("created_at", None)
        data.pop("updated_at", None)

        return super().to_representation(data)

