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

urlpatterns = [
    # Django admin panel
    path("admin/", admin.site.urls),

    # API Routes
    path("api/vms/", include("apps.vms.urls")),
    path("api/sessions/", include("apps.sessions.urls")),
    path("api/classes/", include("apps.classes.urls")),
    path("api/assignments/", include("apps.assignments.urls")),
    path("api/admin/", include("apps.vms.admin_urls")),
    path("api/admin/", include("apps.users.analytics_urls")),

    # ── Health check ─────────────────────────────────────────────────────────
    # Public endpoint — no authentication required.
    path("api/health/", HealthCheckView.as_view(), name="health-check"),

    # ── Authentication & User Endpoints ──────────────────────────────────────
    path("api/", include("apps.users.urls")),
]

# Serve uploaded media files during development.
# In production, a web server (nginx/caddy) should handle /media/ directly.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
