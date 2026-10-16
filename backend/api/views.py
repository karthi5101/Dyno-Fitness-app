from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """
    Basic API health check endpoint.
    """

    def get(self, request):
        return Response(
            {
                "status": "ok",
                "service": "dyno-fitness-api",
                "message": "Dyno Fitness backend is running.",
            }
        )