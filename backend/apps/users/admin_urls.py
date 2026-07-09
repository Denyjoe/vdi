from django.urls import path
from . import admin_views

urlpatterns = [
    path('', admin_views.AdminUserListView.as_view(), name='admin-user-list'), # The prompt used GET /api/users/admin/ so let's match it here
    path('list/', admin_views.AdminUserListView.as_view(), name='admin-user-list-old'), # keep backward compatible if needed
    path('stats/', admin_views.AdminUserStatsView.as_view(), name='admin-user-stats'),
    path('export/', admin_views.AdminExportUsersView.as_view(), name='admin-user-export'),
    path('bulk/', admin_views.AdminBulkActionView.as_view(), name='admin-user-bulk'),
    path('<int:pk>/', admin_views.AdminUserDetailView.as_view(), name='admin-user-detail-old'), # backward compatibility
    path('<int:pk>/detail/', admin_views.AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('<int:pk>/suspend/', admin_views.AdminSuspendUserView.as_view(), name='admin-user-suspend'),
    path('<int:pk>/reactivate/', admin_views.AdminReactivateUserView.as_view(), name='admin-user-reactivate'),
    path('<int:pk>/trigger-reset/', admin_views.AdminTriggerResetView.as_view(), name='admin-user-trigger-reset'),
]
