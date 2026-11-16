from django.conf import settings
from rest_framework import exceptions
from rest_framework.views import APIView


def training_enabled():
    return bool(
        getattr(settings, "WORKOUTS_V2_ENABLED", False)
    )


class TrainingEnabledAPIView(APIView):
    """Base view that hides the training module when its flag is off."""

    def initial(self, request, *args, **kwargs):
        if not training_enabled():
            raise exceptions.NotFound("Training module is disabled.")
        super().initial(request, *args, **kwargs)
