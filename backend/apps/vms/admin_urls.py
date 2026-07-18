from django.urls import path
from . import admin_views

urlpatterns = [
    path('templates/<int:pk>/pricing/', admin_views.AdminTemplatePricingView.as_view(), name='admin-template-pricing'),
    path('workspaces/', admin_views.AdminWorkspacesListView.as_view(), name='admin-workspaces-list'),
    path('workspaces/<int:workspace_id>/force-stop/', admin_views.AdminForceStopWorkspaceView.as_view(), name='admin-workspaces-force-stop'),
    path('workspaces/<int:workspace_id>/', admin_views.AdminDeleteWorkspaceView.as_view(), name='admin-workspaces-delete'),
    path('workspaces/bulk/', admin_views.AdminBulkWorkspaceView.as_view(), name='admin-workspaces-bulk'),
    path('workspaces/<int:workspace_id>/detail/', admin_views.AdminWorkspaceDetailView.as_view(), name='admin-workspaces-detail'),
    path('hardware/', admin_views.AdminHardwareView.as_view(), name='admin-hardware'),
    path('hardware/cpu-history/', admin_views.AdminHardwareCpuHistoryView.as_view(), name='admin-hardware-cpu-history'),
]
