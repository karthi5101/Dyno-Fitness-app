from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsStaffUser

from .repository import get_dashboard_data


class DashboardView(APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        dashboard = get_dashboard_data()

        return Response(dashboard)