"""
Root URL configuration for the DIT VDI System.

All API endpoints are prefixed with /api/.
Each Django app owns its own urls.py; this file wires them together.
Media files are served in development only (DEBUG=True).
"""

from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from django.http import JsonResponse

from apps.users.views import HealthCheckView
import apps.users.views


def api_root(request):
    """Root endpoint — returns API metadata. Prevents 404 on bare domain hits (e.g. ngrok)."""
    return JsonResponse({
        "service": "DIT VDI System API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/api/health/",
    })


urlpatterns = [
    # Root — returns a clean JSON response instead of 404 (e.g. on ngrok bare domain)
    path("", api_root, name="api-root"),

    # Django admin panel
    path("admin/", admin.site.urls),

    # API Routes
    path("api/workspaces/", include("apps.vms.workspace_urls")),
    path("api/vms/", include("apps.vms.urls")),
    path("api/sessions/", include("apps.sessions.urls")),
    path("api/sessions/live/", include("apps.sessions.live_urls")),

    path("api/admin/", include("apps.vms.admin_urls")),
    path("api/users/admin/", include("apps.users.admin_urls")),
    path("api/sessions/admin/", include("apps.sessions.admin_urls")),
    path("api/admin/", include("apps.users.analytics_urls")),
    path("api/vms/admin/", include("apps.vms.pool_urls")),
    path("api/notifications/", include("apps.notifications.urls")),

    # ── Health check & Config ─────────────────────────────────────────────────────────
    # Public endpoint — no authentication required.
    path("api/health/", HealthCheckView.as_view(), name="health-check"),
    path("api/config/announcement/", apps.users.views.AnnouncementView.as_view(), name="system-announcement"),
    path("api/config/session-rate/", apps.users.views.SessionRateConfigView.as_view(), name="session-rate-config"),

    # ── Authentication & User Endpoints ──────────────────────────────────────
    path("api/auth/", include("apps.users.urls")),
    path("api/settings/", include("apps.users.public_urls")),
    path("api/payments/admin/", include("apps.users.admin_payment_urls")),
    path("api/billing/", include("apps.billing.urls")),
    path("api/university/", include("apps.university.urls")),
    path("api/superadmin/university/", include("apps.university.superadmin_urls")),
    path("api/university-admin/", include("apps.university.admin_urls")),
    path("api/pricing/", apps.users.views.PricingView.as_view(), name="public-pricing"),

    # ── Public API v1 — programmatic workspace management, authenticated
    # via the existing Developer-tab API tokens (X-API-Key header) ──────
    path("api/v1/", include("apps.api.urls")),
]

# Serve uploaded media files during development.
# In production, a web server (nginx/caddy) should handle /media/ directly.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
