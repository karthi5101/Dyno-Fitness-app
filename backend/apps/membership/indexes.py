from apps.membership.database import (
    get_memberships_collection,
)


def ensure_membership_indexes():
    collection = get_memberships_collection()

    collection.create_index(
        [
            ("member_id", 1),
        ],
        unique=True,
        name="member_id_unique",
    )