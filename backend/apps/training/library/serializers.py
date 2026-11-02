from rest_framework import serializers

from .utils import (
    normalize_text,
    normalize_text_list,
    tracking_type_for,
)


TRACKING_TYPES = (
    ("weight_reps", "Weight and reps"),
    ("reps", "Reps"),
    ("time", "Time"),
)

LEVELS = (
    ("beginner", "Beginner"),
    ("intermediate", "Intermediate"),
    ("expert", "Expert"),
)

CATEGORIES = (
    ("cardio", "Cardio"),
    ("olympic weightlifting", "Olympic weightlifting"),
    ("plyometrics", "Plyometrics"),
    ("powerlifting", "Powerlifting"),
    ("strength", "Strength"),
    ("stretching", "Stretching"),
    ("strongman", "Strongman"),
)


class ExerciseCreateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=150,
        trim_whitespace=True,
    )
    primary_muscles = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
    )
    secondary_muscles = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
    )
    equipment = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
    )
    level = serializers.ChoiceField(
        choices=LEVELS,
        required=False,
    )
    category = serializers.ChoiceField(
        choices=CATEGORIES,
        required=False,
    )
    instructions = serializers.ListField(
        child=serializers.CharField(
            allow_blank=True,
            trim_whitespace=True,
        ),
        required=False,
    )
    tracking_type = serializers.ChoiceField(
        choices=TRACKING_TYPES,
        required=False,
    )

    def validate_name(self, value):
        value = normalize_text(value)

        if not value:
            raise serializers.ValidationError(
                "A name is required."
            )

        return value

    def validate_primary_muscles(self, value):
        return normalize_text_list(value, lowercase=True)

    def validate_secondary_muscles(self, value):
        return normalize_text_list(value, lowercase=True)

    def validate_equipment(self, value):
        return normalize_text(value).lower()

    def validate_instructions(self, value):
        return normalize_text_list(value)

    def validate(self, attrs):
        attrs.setdefault("primary_muscles", [])
        attrs.setdefault("secondary_muscles", [])
        attrs.setdefault("equipment", "")
        attrs.setdefault("level", "beginner")
        attrs.setdefault("category", "strength")
        attrs.setdefault("instructions", [])
        attrs.setdefault(
            "tracking_type",
            tracking_type_for(
                attrs.get("category"),
                attrs.get("equipment"),
            ),
        )

        return attrs


class ExerciseUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=150,
        trim_whitespace=True,
        required=False,
    )
    primary_muscles = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
    )
    secondary_muscles = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
    )
    equipment = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
    )
    level = serializers.ChoiceField(
        choices=LEVELS,
        required=False,
    )
    category = serializers.ChoiceField(
        choices=CATEGORIES,
        required=False,
    )
    instructions = serializers.ListField(
        child=serializers.CharField(
            allow_blank=True,
            trim_whitespace=True,
        ),
        required=False,
    )
    tracking_type = serializers.ChoiceField(
        choices=TRACKING_TYPES,
        required=False,
    )

    def validate_name(self, value):
        value = normalize_text(value)

        if not value:
            raise serializers.ValidationError(
                "A name is required."
            )

        return value

    def validate_primary_muscles(self, value):
        return normalize_text_list(value, lowercase=True)

    def validate_secondary_muscles(self, value):
        return normalize_text_list(value, lowercase=True)

    def validate_equipment(self, value):
        return normalize_text(value).lower()

    def validate_instructions(self, value):
        return normalize_text_list(value)
