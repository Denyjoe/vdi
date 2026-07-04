"""
URL configuration for admin VM pool management endpoints.

All routes are prefixed with /api/vms/admin/ by config/urls.py.
"""

from django.urls import path
from apps.vms.pool_views import (
    PoolStatusView,
    PoolCreateView,
    PoolCleanupView,
    PoolDeleteEntryView,
    PoolTemplateListView,
    TemplateLinkView,
    SystemStatsView,
)

urlpatterns = [
    path('pool/status/', PoolStatusView.as_view(), name='pool-status'),
    path('pool/create/', PoolCreateView.as_view(), name='pool-create'),
    path('pool/cleanup/', PoolCleanupView.as_view(), name='pool-cleanup'),
    path('pool/<int:entry_id>/', PoolDeleteEntryView.as_view(), name='pool-delete'),
    path('templates/', PoolTemplateListView.as_view(), name='pool-templates'),
    path('templates/<int:template_id>/link/', TemplateLinkView.as_view(), name='template-link'),
    path('system-stats/', SystemStatsView.as_view(), name='system-stats'),
]
