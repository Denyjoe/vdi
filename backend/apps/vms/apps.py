"""
AppConfig for the vms application.
Registers the app under the 'apps.vms' namespace so Django
can locate it correctly within the apps/ package.
"""
from django.apps import AppConfig


class VmsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.vms"
