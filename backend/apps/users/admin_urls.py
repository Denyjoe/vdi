from django.urls import path
from . import admin_views

urlpatterns = [
    path('list/', admin_views.AdminUserListView.as_view(), name='admin-user-list'),
    path('stats/', admin_views.AdminUserStatsView.as_view(), name='admin-user-stats'),
]
