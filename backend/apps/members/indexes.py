from .database import get_members_collection


def ensure_member_indexes():
    """
    Create indexes required by the Members collection.
    """
    collection = get_members_collection()

    collection.create_index(
        "member_id",
        unique=True,
        name="member_id_unique",
    )