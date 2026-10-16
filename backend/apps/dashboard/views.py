from rest_framework.response import Response
from rest_framework.views import APIView

from .repository import get_dashboard_data


class DashboardView(APIView):
    def get(self, request):
        dashboard = get_dashboard_data()

        return Response(dashboard)