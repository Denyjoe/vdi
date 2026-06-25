from django.urls import path
from . import analytics_views

urlpatterns = [
    path('analytics/overview/', analytics_views.AdminAnalyticsOverview.as_view(), name='analytics-overview'),
    path('analytics/session-trends/', analytics_views.AdminSessionTrends.as_view(), name='analytics-session-trends'),
    path('analytics/vm-usage/', analytics_views.AdminVMUsageStats.as_view(), name='analytics-vm-usage'),
    path('analytics/activity/', analytics_views.AdminActivityStats.as_view(), name='analytics-activity'),
    path('analytics/assignments/', analytics_views.AdminAssignmentStats.as_view(), name='analytics-assignments'),
]
