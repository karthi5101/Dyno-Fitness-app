from rest_framework import serializers


class DietMealItemSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=200,
    )

    quantity = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )

    notes = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
    )


class DietMealSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=100,
    )

    meal_type = serializers.ChoiceField(
        choices=[
            "breakfast",
            "mid_morning_snack",
            "lunch",
            "evening_snack",
            "dinner",
        ],
    )

    items = DietMealItemSerializer(
        many=True,
    )


class DietTemplateSerializer(serializers.Serializer):
    template_key = serializers.CharField(
        max_length=100,
    )

    name = serializers.CharField(
        max_length=200,
    )

    description = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
    )

    target_calories = serializers.IntegerField(
        min_value=1,
        required=False,
        allow_null=True,
    )

    meals = DietMealSerializer(
        many=True,
    )


class DietAssignmentSerializer(serializers.Serializer):
    member_id = serializers.CharField(
        max_length=100,
    )

    template_key = serializers.CharField(
        max_length=100,
    )

    assigned_date = serializers.DateField()

    status = serializers.ChoiceField(
        choices=[
            "active",
            "completed",
            "cancelled",
        ],
        required=False,
        default="active",
    )

    notes = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
    )