
from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import UserMemberProfile


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    def validate(self, attrs):
        login_identifier = attrs.get("username")
        password = attrs.get("password")

        # Member ID login: find the linked Django account.
        profile = (
            UserMemberProfile.objects
            .select_related("user")
            .filter(member_id=login_identifier)
            .first()
        )

        if profile is not None:
            user = profile.user

            if not user.is_active:
                raise serializers.ValidationError(
                    "This account is inactive."
                )

            authenticated_user = authenticate(
                username=user.username,
                password=password,
            )

        else:
            # Preserve existing staff username login.
            authenticated_user = authenticate(
                username=login_identifier,
                password=password,
            )

        if authenticated_user is None:
            raise serializers.ValidationError(
                "Invalid username or password."
            )

        if not authenticated_user.is_active:
            raise serializers.ValidationError(
                "This account is inactive."
            )

        attrs["user"] = authenticated_user
        return attrs
