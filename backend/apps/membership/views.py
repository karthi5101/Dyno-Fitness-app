from pymongo.errors import DuplicateKeyError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import (
    IsStaffUser,
    MemberScopedAccess,
)
from apps.membership.repository import (
    create_membership,
    get_all_memberships,
    get_membership_by_member_id,
    update_membership,
)
from apps.membership.serializers import MembershipSerializer


class MembershipListCreateView(APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        memberships = get_all_memberships()

        serializer = MembershipSerializer(
            memberships,
            many=True,
        )

        return Response(serializer.data)

    def post(self, request):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "create a membership."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = MembershipSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        if get_membership_by_member_id(
            serializer.validated_data["member_id"]
        ) is not None:
            return Response(
                {
                    "detail": (
                        "This member already has a membership record."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            membership = create_membership(
                serializer.validated_data
            )
        except DuplicateKeyError:
            return Response(
                {
                    "detail": (
                        "This member already has a membership record."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        except Exception as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        response_serializer = MembershipSerializer(
            membership
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )


class MembershipDetailView(APIView):
    permission_classes = [MemberScopedAccess]

    def get(self, request, member_id):
        membership = get_membership_by_member_id(
            member_id
        )

        if membership is None:
            return Response(
                {
                    "detail": "Membership not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MembershipSerializer(
            membership
        )

        return Response(serializer.data)

    def patch(self, request, member_id):
        if not request.user.is_staff:
            return Response(
                {
                    "detail": (
                        "Staff access is required to "
                        "update a membership."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        existing_membership = (
            get_membership_by_member_id(member_id)
        )

        if existing_membership is None:
            return Response(
                {
                    "detail": "Membership not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MembershipSerializer(
            data=request.data,
            partial=True,
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        start_date = serializer.validated_data.get(
            "start_date",
            existing_membership.get("start_date"),
        )
        end_date = serializer.validated_data.get(
            "end_date",
            existing_membership.get("end_date"),
        )

        if hasattr(start_date, "date"):
            start_date = start_date.date()

        if hasattr(end_date, "date"):
            end_date = end_date.date()

        if start_date and end_date and end_date < start_date:
            return Response(
                {
                    "end_date": [
                        "End date must be on or after the start date."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            membership = update_membership(
                member_id,
                serializer.validated_data,
            )
        except DuplicateKeyError:
            return Response(
                {
                    "detail": (
                        "This member already has a membership record."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        except Exception as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if membership is None:
            return Response(
                {
                    "detail": "Membership not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        response_serializer = MembershipSerializer(
            membership
        )

        return Response(response_serializer.data)