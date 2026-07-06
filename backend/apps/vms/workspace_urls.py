from django.urls import path
from . import workspace_views

urlpatterns = [
    path('', workspace_views.WorkspaceListView.as_view(), name='workspace-list'),
    path('create/', workspace_views.WorkspaceCreateView.as_view(), name='workspace-create'),
    path('<int:pk>/', workspace_views.WorkspaceDetailView.as_view(), name='workspace-detail'),
    path('<int:pk>/launch/', workspace_views.WorkspaceLaunchView.as_view(), name='workspace-launch'),
    path('<int:pk>/stop/', workspace_views.WorkspaceStopView.as_view(), name='workspace-stop'),
    path('<int:pk>/delete/', workspace_views.WorkspaceDeleteView.as_view(), name='workspace-delete'),
    path('<int:pk>/stats/', workspace_views.WorkspaceStatsView.as_view(), name='workspace-stats'),
]
