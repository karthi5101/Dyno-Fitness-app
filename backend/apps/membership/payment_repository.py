from datetime import datetime, time
from decimal import Decimal

from bson import ObjectId
from bson.decimal128 import Decimal128

from apps.members.database import get_members_collection
from apps.membership.payment_database import (
    get_payments_collection,
)


def _date_to_datetime(value):
    if hasattr(value, "year") and not isinstance(value, datetime):
        return datetime.combine(value, time.min)

    return value


def _amount_to_decimal128(value):
    if isinstance(value, Decimal128):
        return value

    if isinstance(value, Decimal):
        return Decimal128(value)

    return Decimal128(str(value))


def _normalize_document(document):
    if document is None:
        return None

    document = dict(document)

    amount = document.get("amount")

    if isinstance(amount, Decimal128):
        document["amount"] = amount.to_decimal()

    return document


def _normalize_documents(documents):
    return [
        _normalize_document(document)
        for document in documents
    ]


def member_exists(member_id):
    collection = get_members_collection()

    return collection.find_one(
        {
            "member_id": member_id,
        },
        {
            "_id": 1,
        },
    ) is not None


def create_payment(data):
    collection = get_payments_collection()

    member_id = data["member_id"]

    if not member_exists(member_id):
        raise ValueError("Member not found.")

    now = datetime.utcnow()

    document = {
        "member_id": member_id,
        "amount": _amount_to_decimal128(
            data["amount"]
        ),
        "payment_date": _date_to_datetime(
            data["payment_date"]
        ),
        "payment_method": data["payment_method"],
        "period_start": _date_to_datetime(
            data["period_start"]
        ),
        "period_end": _date_to_datetime(
            data["period_end"]
        ),
        "notes": data.get("notes"),
        "created_at": now,
        "updated_at": now,
    }

    result = collection.insert_one(document)

    document["_id"] = result.inserted_id

    return _normalize_document(document)


def get_all_payments():
    collection = get_payments_collection()

    documents = list(
        collection.find().sort(
            [
                ("payment_date", -1),
                ("created_at", -1),
            ]
        )
    )

    return _normalize_documents(documents)


def get_payments_by_member_id(member_id):
    collection = get_payments_collection()

    documents = list(
        collection.find(
            {
                "member_id": member_id,
            }
        ).sort(
            [
                ("payment_date", -1),
                ("created_at", -1),
            ]
        )
    )

    return _normalize_documents(documents)


def get_payment_by_id(payment_id):
    collection = get_payments_collection()

    if not ObjectId.is_valid(payment_id):
        return None

    document = collection.find_one(
        {
            "_id": ObjectId(payment_id),
        }
    )

    return _normalize_document(document)


def update_payment(payment_id, data):
    collection = get_payments_collection()

    if not ObjectId.is_valid(payment_id):
        return None

    if "member_id" in data:
        member_id = data["member_id"]

        if not member_exists(member_id):
            raise ValueError("Member not found.")

    update_data = {}

    for field, value in data.items():
        if field in {
            "payment_date",
            "period_start",
            "period_end",
        }:
            value = _date_to_datetime(value)

        elif field == "amount":
            value = _amount_to_decimal128(value)

        update_data[field] = value

    if not update_data:
        document = collection.find_one(
            {
                "_id": ObjectId(payment_id),
            }
        )

        return _normalize_document(document)

    update_data["updated_at"] = datetime.utcnow()

    result = collection.update_one(
        {
            "_id": ObjectId(payment_id),
        },
        {
            "$set": update_data,
        },
    )

    if result.matched_count == 0:
        return None

    document = collection.find_one(
        {
            "_id": ObjectId(payment_id),
        }
    )

    return _normalize_document(document)


def delete_payment(payment_id):
    collection = get_payments_collection()

    if not ObjectId.is_valid(payment_id):
        return False

    result = collection.delete_one(
        {
            "_id": ObjectId(payment_id),
        }
    )

    return result.deleted_count > 0

