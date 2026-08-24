"""Public, unauthenticated university-layer endpoints."""
from django.urls import path
from .views import UniversityAccessRequestView

urlpatterns = [
    path('request-access/', UniversityAccessRequestView.as_view(), name='university-request-access'),
]
