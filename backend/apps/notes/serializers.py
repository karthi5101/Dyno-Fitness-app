from rest_framework import serializers


class NoteSerializer(serializers.Serializer):
    id = serializers.SerializerMethodField()
    member_id = serializers.CharField(max_length=50)
    title = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
    )
    body = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    def get_id(self, obj):
        note_id = obj.get("_id") or obj.get("id")

        if note_id is None:
            return None

        return str(note_id)

    def validate_member_id(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "A member ID is required."
            )

        return value


class NoteUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
    )

    body = serializers.CharField(
        required=False,
        allow_blank=True,
    )
