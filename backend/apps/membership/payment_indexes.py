from apps.membership.payment_database import (
    get_payments_collection,
)


def ensure_payment_indexes():
    collection = get_payments_collection()

    collection.create_index(
        [
            ("member_id", 1),
            ("payment_date", -1),
        ],
        name="member_payment_date",
    )