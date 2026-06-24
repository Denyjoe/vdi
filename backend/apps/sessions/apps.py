"""
AppConfig for the sessions application.

The label is explicitly set to 'vdi_sessions' to avoid a naming
collision with Django's built-in 'django.contrib.sessions' app,
which also registers the label 'sessions'.
"""
from django.apps import AppConfig


class SessionsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.sessions"
    label = "vdi_sessions"  # Avoids clash with django.contrib.sessions
