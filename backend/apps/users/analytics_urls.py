from django.urls import path
from apps.users.analytics_views import (
    AnalyticsOverviewView,
    AnalyticsSessionTrendsView,
    AnalyticsVMUsageView,
    AnalyticsActivityView,
    AnalyticsAssignmentsView
)

urlpatterns = [
    path('analytics/overview/', AnalyticsOverviewView.as_view(), name='analytics-overview'),
    path('analytics/session-trends/', AnalyticsSessionTrendsView.as_view(), name='analytics-trends'),
    path('analytics/vm-usage/', AnalyticsVMUsageView.as_view(), name='analytics-vm-usage'),
    path('analytics/activity/', AnalyticsActivityView.as_view(), name='analytics-activity'),
    path('analytics/assignments/', AnalyticsAssignmentsView.as_view(), name='analytics-assignments'),
    path('config/', __import__('apps.users.admin_views').users.admin_views.SystemConfigView.as_view(), name='admin-system-config'),
]
