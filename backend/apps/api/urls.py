from django.urls import path
from . import v1_views

urlpatterns = [
    path('workspaces/', v1_views.PublicApiWorkspaceListCreateView.as_view(), name='public-api-workspaces'),
    path('workspaces/<int:workspace_id>/', v1_views.PublicApiWorkspaceDetailView.as_view(), name='public-api-workspace-detail'),
]
