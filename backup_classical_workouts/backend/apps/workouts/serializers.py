from rest_framework import serializers


PROTOTYPE_TEMPLATE_KEYS = {
    "strength",
    "weight_loss",
    "weight_gain",
    "endurance",
}


class WorkoutExerciseSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=150,
        trim_whitespace=True,
    )

    sets = serializers.IntegerField(
        min_value=1,
    )

    reps = serializers.IntegerField(
        min_value=1,
    )

    weight = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    order = serializers.IntegerField(
        min_value=0,
        required=False,
    )


class WorkoutSplitDaySerializer(serializers.Serializer):
    day = serializers.IntegerField(
        min_value=1,
        max_value=6,
    )

    label = serializers.CharField(
        max_length=50,
        trim_whitespace=True,
    )

    exercises = WorkoutExerciseSerializer(
        many=True,
    )

    def validate_label(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Every split day needs a label."
            )

        return value

    def validate_exercises(self, value):
        if not value:
            raise serializers.ValidationError(
                "Every split day must contain at least one exercise."
            )

        return value


class WorkoutTemplateSerializer(serializers.Serializer):
    template_key = serializers.CharField(
        max_length=50,
        trim_whitespace=True,
    )

    name = serializers.CharField(
        max_length=100,
        trim_whitespace=True,
    )

    description = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    exercises = WorkoutExerciseSerializer(
        many=True,
        required=True,
    )

    split_days = WorkoutSplitDaySerializer(
        many=True,
        required=False,
    )

    def validate_template_key(self, value):
        value = value.strip().lower()

        if value not in PROTOTYPE_TEMPLATE_KEYS:
            raise serializers.ValidationError(
                "Invalid workout template type."
            )

        return value

    def validate_exercises(self, value):
        if not value:
            raise serializers.ValidationError(
                "A workout template must contain at least one exercise."
            )

        return value

    def validate_split_days(self, value):
        if value is None:
            return value

        if len(value) != 6:
            raise serializers.ValidationError(
                "A split must contain exactly six days."
            )

        days = sorted(item["day"] for item in value)

        if days != [1, 2, 3, 4, 5, 6]:
            raise serializers.ValidationError(
                "Split days must be exactly 1, 2, 3, 4, 5 and 6 "
                "with no duplicates."
            )

        return value


class WorkoutTemplateUpdateSerializer(serializers.Serializer):
    template_key = serializers.CharField(
        max_length=50,
        required=False,
        trim_whitespace=True,
    )

    name = serializers.CharField(
        max_length=100,
        required=False,
        trim_whitespace=True,
    )

    description = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    exercises = WorkoutExerciseSerializer(
        many=True,
        required=False,
    )

    split_days = WorkoutSplitDaySerializer(
        many=True,
        required=False,
    )

    def validate_template_key(self, value):
        value = value.strip().lower()

        if value not in PROTOTYPE_TEMPLATE_KEYS:
            raise serializers.ValidationError(
                "Invalid workout template type."
            )

        return value

    def validate_exercises(self, value):
        if not value:
            raise serializers.ValidationError(
                "A workout template must contain at least one exercise."
            )

        return value

    def validate_split_days(self, value):
        if value is None:
            return value

        if len(value) != 6:
            raise serializers.ValidationError(
                "A split must contain exactly six days."
            )

        days = sorted(item["day"] for item in value)

        if days != [1, 2, 3, 4, 5, 6]:
            raise serializers.ValidationError(
                "Split days must be exactly 1, 2, 3, 4, 5 and 6 "
                "with no duplicates."
            )

        return value


class WorkoutAssignmentSerializer(serializers.Serializer):
    member_id = serializers.CharField(
        max_length=50,
        trim_whitespace=True,
    )

    template_id = serializers.CharField(
        max_length=50,
        trim_whitespace=True,
    )


class DailyWorkoutSerializer(serializers.Serializer):
    member_id = serializers.CharField(
        max_length=50,
        trim_whitespace=True,
    )

    workout_date = serializers.DateField()

    exercises = WorkoutExerciseSerializer(
        many=True,
    )

    def validate_exercises(self, value):
        if not value:
            raise serializers.ValidationError(
                "A daily workout must contain at least one exercise."
            )

        return value


class DailyWorkoutGenerateSerializer(serializers.Serializer):
    member_id = serializers.CharField(
        max_length=50,
        trim_whitespace=True,
    )

    workout_date = serializers.DateField(
        required=False,
    )

    split = serializers.BooleanField(
        required=False,
        default=False,
    )


class DailyWorkoutCompleteSerializer(serializers.Serializer):
    workout_id = serializers.CharField(
        max_length=50,
        trim_whitespace=True,
    )


class DailyWorkoutUpdateSerializer(serializers.Serializer):
    exercises = WorkoutExerciseSerializer(
        many=True,
    )

    def validate_exercises(self, value):
        if not value:
            raise serializers.ValidationError(
                "A daily workout must contain at least one exercise."
            )

        return value