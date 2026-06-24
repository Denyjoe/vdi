"""
AppConfig for the classes application.
Registers the app under the 'apps.classes' namespace so Django
can locate it correctly within the apps/ package.
"""
from django.apps import AppConfig


class ClassesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.classes"
