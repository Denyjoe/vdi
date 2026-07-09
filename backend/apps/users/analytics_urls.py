from django.urls import path
from apps.users.analytics_views import (
    AnalyticsOverviewView,
    AnalyticsSessionTrendsView,
    AnalyticsVMUsageView,
    AnalyticsActivityView,
    AnalyticsAssignmentsView,
    SessionsDailyView,
    RevenueMonthlyView,
    UserGrowthView,
    RevenueBreakdownView,
    PlatformStatsView,
    AdminAnalyticsExportView
)

urlpatterns = [
    path('analytics/overview/', AnalyticsOverviewView.as_view(), name='analytics-overview'),
    path('analytics/session-trends/', AnalyticsSessionTrendsView.as_view(), name='analytics-trends'),
    path('analytics/vm-usage/', AnalyticsVMUsageView.as_view(), name='analytics-vm-usage'),
    path('analytics/activity/', AnalyticsActivityView.as_view(), name='analytics-activity'),
    path('analytics/assignments/', AnalyticsAssignmentsView.as_view(), name='analytics-assignments'),
    
    path('analytics/sessions-daily/', SessionsDailyView.as_view(), name='analytics-sessions-daily'),
    path('analytics/revenue-monthly/', RevenueMonthlyView.as_view(), name='analytics-revenue-monthly'),
    path('analytics/user-growth/', UserGrowthView.as_view(), name='analytics-user-growth'),
    path('analytics/revenue-breakdown/', RevenueBreakdownView.as_view(), name='analytics-revenue-breakdown'),
    path('analytics/export/', AdminAnalyticsExportView.as_view(), name='analytics-export'),
    path('platform-stats/', PlatformStatsView.as_view(), name='platform-stats'),
    
    path('config/', __import__('apps.users.admin_views').users.admin_views.SystemConfigView.as_view(), name='admin-system-config'),
    
    path('attention/', __import__('apps.users.admin_dashboard_views').users.admin_dashboard_views.AdminAttentionView.as_view(), name='admin-attention'),
    path('services/retry/', __import__('apps.users.admin_dashboard_views').users.admin_dashboard_views.ServiceRetryView.as_view(), name='admin-service-retry'),
    path('activity/', __import__('apps.users.admin_dashboard_views').users.admin_dashboard_views.AdminActivityView.as_view(), name='admin-activity'),
    path('backup/trigger/', __import__('apps.users.admin_dashboard_views').users.admin_dashboard_views.TriggerBackupView.as_view(), name='admin-backup-trigger'),
]
