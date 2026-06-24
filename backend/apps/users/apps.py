"""
AppConfig for the users application.
Registers the app under the 'apps.users' namespace so Django
can locate it correctly within the apps/ package.
"""
from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.users"
