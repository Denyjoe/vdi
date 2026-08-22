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
    PoolEntriesView,
    PoolCapacityView,
    PoolConfigView,
    TemplateTestLinkView,
    TemplatePreviewView,
    TemplatePreviewCleanupView,
    AdminTemplateDetailView,
    UnlinkedTemplatesView,
    UnlinkedTemplateLinkView,
    UnlinkedTemplateDeleteView,
)

urlpatterns = [
    path('pool/status/', PoolStatusView.as_view(), name='pool-status'),
    path('pool/create/', PoolCreateView.as_view(), name='pool-create'),
    path('pool/cleanup/', PoolCleanupView.as_view(), name='pool-cleanup'),
    path('pool/entries/', PoolEntriesView.as_view(), name='pool-entries'),
    path('pool/capacity/', PoolCapacityView.as_view(), name='pool-capacity'),
    path('pool/<int:entry_id>/', PoolDeleteEntryView.as_view(), name='pool-delete'),
    path('templates/', PoolTemplateListView.as_view(), name='pool-templates'),
    # Real, deliberate absence: template creation only ever happens
    # through the real wizard (template_wizard_views.AdminTemplateJobPromoteView),
    # which requires an actual verified Proxmox VM behind it. The old
    # AdminTemplateCreateView let an admin create a VMTemplate row with
    # is_real=False and nothing real backing it — a fake catalogue
    # entry a member could see and try to launch. Removed entirely so
    # there is exactly one way to create a template.
    # Real Proxmox-vs-DB reconciliation for templates — must come before
    # the <int:template_id> catch-all below.
    path('templates/unlinked/', UnlinkedTemplatesView.as_view(), name='unlinked-templates'),
    path('templates/unlinked/link/', UnlinkedTemplateLinkView.as_view(), name='unlinked-template-link'),
    path('templates/unlinked/delete/', UnlinkedTemplateDeleteView.as_view(), name='unlinked-template-delete'),
    path('templates/<int:template_id>/', AdminTemplateDetailView.as_view(), name='admin-template-detail'),
    path('templates/<int:template_id>/link/', TemplateLinkView.as_view(), name='template-link'),
    path('templates/<int:template_id>/test-link/', TemplateTestLinkView.as_view(), name='template-test-link'),
    path('templates/<int:template_id>/preview/', TemplatePreviewView.as_view(), name='template-preview'),
    path('templates/<int:template_id>/preview-cleanup/', TemplatePreviewCleanupView.as_view(), name='template-preview-cleanup'),
    path('templates/<int:template_id>/pool-config/', PoolConfigView.as_view(), name='template-pool-config'),
    path('system-stats/', SystemStatsView.as_view(), name='system-stats'),
]
