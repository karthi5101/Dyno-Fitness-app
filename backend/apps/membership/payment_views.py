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


class PaymentListCreateView(APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        payments = get_all_payments()

        serializer = PaymentSerializer(
            payments,
            many=True,
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
            payment
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

        serializer = PaymentSerializer(payment)

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
            payment
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