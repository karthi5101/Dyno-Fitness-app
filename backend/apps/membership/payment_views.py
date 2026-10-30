from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import (
    IsStaffUser,
    MemberScopedAccess,
)
from apps.membership.payment_repository import (
    create_payment,
    delete_payment,
    get_all_payments,
    get_payment_by_id,
    get_payments_by_member_id,
    update_payment,
)
from apps.membership.payment_serializers import (
    PaymentSerializer,
)
from apps.uploads import (
    PAYMENT_CONTENT_TYPES,
    delete_upload,
    metadata_fields,
    save_upload,
)


class PaymentListCreateView(APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        payments = get_all_payments()

        serializer = PaymentSerializer(
            payments,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)

    def post(self, request):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "record a payment."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PaymentSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payment = create_payment(
                serializer.validated_data
            )
        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        response_serializer = PaymentSerializer(
            payment,
            context={"request": request},
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )


class PaymentMemberListView(APIView):
    permission_classes = [MemberScopedAccess]

    def get(self, request, member_id):
        payments = get_payments_by_member_id(
            member_id
        )

        serializer = PaymentSerializer(
            payments,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)


class PaymentProofUploadView(APIView):
    permission_classes = [IsStaffUser]

    def post(self, request, payment_id):
        payment = get_payment_by_id(payment_id)

        if payment is None:
            return Response(
                {"detail": "Payment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            upload_metadata = save_upload(
                request.FILES.get("file"),
                allowed_content_types=PAYMENT_CONTENT_TYPES,
                purpose="payment_proof",
            )
        except ValueError as exc:
            return Response(
                {"file": [str(exc)]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_file_id = payment.get("payment_proof_file_id")
        fields = metadata_fields(
            "payment_proof",
            upload_metadata,
        )

        updated = update_payment(payment_id, fields)

        if updated is None:
            delete_upload(upload_metadata["file_id"])

            return Response(
                {"detail": "Payment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if old_file_id and old_file_id != upload_metadata["file_id"]:
            delete_upload(old_file_id)

        serializer = PaymentSerializer(
            updated,
            context={"request": request},
        )

        return Response(serializer.data)


class PaymentDetailView(APIView):
    permission_classes = [IsStaffUser]

    def get(self, request, payment_id):
        payment = get_payment_by_id(payment_id)

        if payment is None:
            return Response(
                {
                    "detail": "Payment not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PaymentSerializer(
            payment,
            context={"request": request},
        )

        return Response(serializer.data)

    def patch(self, request, payment_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "update a payment."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        existing_payment = get_payment_by_id(
            payment_id
        )

        if existing_payment is None:
            return Response(
                {
                    "detail": "Payment not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PaymentSerializer(
            data=request.data,
            partial=True,
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payment = update_payment(
                payment_id,
                serializer.validated_data,
            )
        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if payment is None:
            return Response(
                {
                    "detail": "Payment not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        response_serializer = PaymentSerializer(
            payment,
            context={"request": request},
        )

        return Response(response_serializer.data)

    def delete(self, request, payment_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "delete a payment."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        deleted = delete_payment(payment_id)

        if not deleted:
            return Response(
                {
                    "detail": "Payment not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )