from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .flag import TrainingEnabledAPIView


class TrainingHealthView(TrainingEnabledAPIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "status": "ok",
                "module": "training",
            }
        )
