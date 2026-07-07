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

from apps.users.views import HealthCheckView
import apps.users.views

urlpatterns = [
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

    # ── Health check ─────────────────────────────────────────────────────────
    # Public endpoint — no authentication required.
    path("api/health/", HealthCheckView.as_view(), name="health-check"),

    # ── Authentication & User Endpoints ──────────────────────────────────────
    path("api/auth/", include("apps.users.urls")),
    path("api/settings/", include("apps.users.public_urls")),
    path("api/subscriptions/", include("apps.users.subscription_urls")),
    path("api/payments/admin/", include("apps.users.admin_payment_urls")),
    path("api/payments/", include("apps.users.payment_urls")),
    path("api/billing/", include("apps.billing.urls")),
    path("api/pricing/", apps.users.views.PricingView.as_view(), name="public-pricing"),
]

# Serve uploaded media files during development.
# In production, a web server (nginx/caddy) should handle /media/ directly.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
