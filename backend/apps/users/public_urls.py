from django.urls import path
from .views import PublicSettingsView

urlpatterns = [
    path('settings/public/', PublicSettingsView.as_view(), name='public-settings'),
]
