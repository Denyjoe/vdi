from django.urls import path
from .views import AdminVMListView, AdminVMForceStopView, HardwareStatsView, HardwareCpuHistoryView

urlpatterns = [
    path('vms/', AdminVMListView.as_view(), name='admin-vm-list'),
    path('vms/<int:pk>/force-stop/', AdminVMForceStopView.as_view(), name='admin-vm-force-stop'),
    path('hardware/', HardwareStatsView.as_view(), name='admin-hardware-stats'),
    path('hardware/cpu-history/', HardwareCpuHistoryView.as_view(), name='admin-hardware-cpu-history'),
]
