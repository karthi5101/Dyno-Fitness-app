
from rest_framework import serializers


SESSION_CHOICES = [
    ("morning_first", "Morning - First Half"),
    ("morning_second", "Morning - Second Half"),
    ("evening_first", "Evening - First Half"),
    ("evening_second", "Evening - Second Half"),
]


class MemberSerializer(serializers.Serializer):
    member_id = serializers.CharField(max_length=20)

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        min_length=8,
    )

    name = serializers.CharField(max_length=100)
    phone = serializers.CharField(max_length=20)

    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    date_of_birth = serializers.DateField(
        required=False,
        allow_null=True,
    )

    gender = serializers.ChoiceField(
        choices=[
            ("male", "Male"),
            ("female", "Female"),
            ("other", "Other"),
        ],
        required=False,
        allow_null=True,
    )

    joining_date = serializers.DateField()

    # The backend always creates new members as active.
    status = serializers.ChoiceField(
        choices=[
            ("active", "Active"),
            ("inactive", "Inactive"),
        ],
        required=False,
        write_only=True,
    )

    emergency_contact = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    preferred_session = serializers.ChoiceField(
        choices=SESSION_CHOICES,
        required=False,
        allow_null=True,
    )


class MemberUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=100,
        required=False,
    )

    phone = serializers.CharField(
        max_length=20,
        required=False,
    )

    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    date_of_birth = serializers.DateField(
        required=False,
        allow_null=True,
    )

    gender = serializers.ChoiceField(
        choices=[
            ("male", "Male"),
            ("female", "Female"),
            ("other", "Other"),
        ],
        required=False,
        allow_null=True,
    )

    joining_date = serializers.DateField(required=False)

    status = serializers.ChoiceField(
        choices=[
            ("active", "Active"),
            ("inactive", "Inactive"),
        ],
        required=False,
    )

    emergency_contact = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    preferred_session = serializers.ChoiceField(
        choices=SESSION_CHOICES,
        required=False,
        allow_null=True,
    )
