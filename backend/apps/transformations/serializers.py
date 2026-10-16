from decimal import Decimal

from rest_framework import serializers


class TransformationSerializer(serializers.Serializer):
    member_id = serializers.CharField(
        max_length=100,
    )

    week_number = serializers.IntegerField(
        min_value=1,
    )

    recorded_date = serializers.DateField()

    weight_kg = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0.10"),
    )

    image_url = serializers.CharField(
        max_length=2000,
        allow_blank=True,
        required=False,
        default="",
    )

    notes = serializers.CharField(
        max_length=1000,
        allow_blank=True,
        required=False,
        default="",
    )
