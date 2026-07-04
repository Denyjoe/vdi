from django.urls import path
from . import admin_views

urlpatterns = [
    path('stats/', admin_views.AdminSessionStatsView.as_view(), name='admin-session-stats'),
]
