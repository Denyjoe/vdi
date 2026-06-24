from django.urls import path
from .views import (
    VMTemplateListView, VMTemplateDetailView,
    VMListView, VMRequestView,
    VMDetailView, VMStatusView,
    VMStopView, VMStartView
)

urlpatterns = [
    path('templates/', VMTemplateListView.as_view(), name='vm-template-list'),
    path('templates/<int:pk>/', VMTemplateDetailView.as_view(), name='vm-template-detail'),
    path('my-vms/', VMListView.as_view(), name='vm-list'),
    path('request/', VMRequestView.as_view(), name='vm-request'),
    # GET + DELETE are both handled by VMDetailView
    path('<int:pk>/', VMDetailView.as_view(), name='vm-detail'),
    path('<int:pk>/status/', VMStatusView.as_view(), name='vm-status'),
    path('<int:pk>/stop/', VMStopView.as_view(), name='vm-stop'),
    path('<int:pk>/start/', VMStartView.as_view(), name='vm-start'),
]
