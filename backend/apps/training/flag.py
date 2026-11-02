from django.conf import settings
from django.http import Http404
from rest_framework.views import APIView


def training_enabled():
    return bool(
        getattr(settings, "WORKOUTS_V2_ENABLED", False)
    )


class TrainingEnabledAPIView(APIView):
    """Base view that hides the training module when its flag is off."""

    def dispatch(self, request, *args, **kwargs):
        if not training_enabled():
            raise Http404("Training module is disabled.")

        return super().dispatch(request, *args, **kwargs)
