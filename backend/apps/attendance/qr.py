from django.core import signing
from django.utils import timezone


QR_SALT = "dyno-fitness-gym-attendance"
QR_MAX_AGE = 60 * 60 * 24


def generate_daily_qr_token():
    """
    Generate a signed QR token for the current
    local calendar date.
    """

    today = timezone.localdate()

    signer = signing.TimestampSigner(
        salt=QR_SALT,
    )

    return signer.sign(
        today.isoformat(),
    )


def validate_daily_qr_token(qr_token):
    """
    Validate that the QR token is:

    1. Cryptographically valid.
    2. Recent enough.
    3. Issued for today's local date.

    Returns True when valid, otherwise False.
    """

    if not qr_token:
        return False

    signer = signing.TimestampSigner(
        salt=QR_SALT,
    )

    try:
        signed_date = signer.unsign(
            qr_token,
            max_age=QR_MAX_AGE,
        )
    except signing.BadSignature:
        return False
    except signing.SignatureExpired:
        return False

    today = timezone.localdate()

    return signed_date == today.isoformat()