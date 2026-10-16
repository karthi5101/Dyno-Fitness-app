from rest_framework import serializers


class AttendanceQRScanSerializer(serializers.Serializer):
    qr_token = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )