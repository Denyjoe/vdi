from django.urls import path
from .views import (
    AdminVMListView, AdminVMForceStopView,
    HardwareStatsView, HardwareCpuHistoryView,
    AdminTemplateListCreateView, AdminTemplateDetailView
)

from apps.sessions.views import AdminSessionsView, AdminTerminateSessionView
from apps.classes.views import (
    AdminClassListView, AdminCreateClassView, AdminEnrollStudentView,
    AdminStreamCreateView, AdminStreamUpdateView
)

urlpatterns = [
    path('vms/', AdminVMListView.as_view(), name='admin-vm-list'),
    path('vms/<int:pk>/force-stop/', AdminVMForceStopView.as_view(), name='admin-vm-force-stop'),
    path('vms/templates/', AdminTemplateListCreateView.as_view(), name='admin-template-list-create'),
    path('vms/templates/<int:pk>/', AdminTemplateDetailView.as_view(), name='admin-template-detail'),
    path('hardware/', HardwareStatsView.as_view(), name='admin-hardware-stats'),
    path('hardware/cpu-history/', HardwareCpuHistoryView.as_view(), name='admin-hardware-cpu-history'),
    path('sessions/', AdminSessionsView.as_view(), name='admin-session-list'),
    path('sessions/<int:pk>/terminate/', AdminTerminateSessionView.as_view(), name='admin-session-terminate'),
    path('classes/', AdminClassListView.as_view(), name='admin-class-list'),
    path('classes/create/', AdminCreateClassView.as_view(), name='admin-class-create'),
    path('classes/<int:pk>/enroll/', AdminEnrollStudentView.as_view(), name='admin-class-enroll'),
    # Course Streams
    path('classes/streams/', AdminStreamCreateView.as_view(), name='admin-stream-create'),
    path('classes/streams/<int:pk>/', AdminStreamUpdateView.as_view(), name='admin-stream-update'),
]

