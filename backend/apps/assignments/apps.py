"""
AppConfig for the assignments application.
Registers the app under the 'apps.assignments' namespace so Django
can locate it correctly within the apps/ package.
"""
from django.apps import AppConfig


class AssignmentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.assignments"
