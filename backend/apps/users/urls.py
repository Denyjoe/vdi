from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, LoginView, LogoutView, MeView, ChangePasswordView,
    UserListView, UserDetailView, UserDeactivateView, UserActivateView,
    AdminLogsView, UpdateProfileView, AvatarView, UserStatsView,
    SystemSettingsView, UpdateSystemSettingView
)

urlpatterns = [
    # Auth
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Profile
    path('auth/profile/update/', UpdateProfileView.as_view(), name='profile-update'),
    path('auth/profile/avatar/', AvatarView.as_view(), name='avatar'),
    path('auth/profile/stats/', UserStatsView.as_view(), name='profile-stats'),
    
    # Admin User Management
    path('admin/users/', UserListView.as_view(), name='admin-user-list'),
    path('admin/users/<int:pk>/', UserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:pk>/deactivate/', UserDeactivateView.as_view(), name='admin-user-deactivate'),
    path('admin/users/<int:pk>/activate/', UserActivateView.as_view(), name='admin-user-activate'),
    
    # Admin Logs
    path('admin/logs/', AdminLogsView.as_view(), name='admin-logs'),
    
    # Admin Settings
    path('admin/settings/', SystemSettingsView.as_view(), name='admin-settings'),
    path('admin/settings/<str:key>/', UpdateSystemSettingView.as_view(), name='admin-setting-update'),
]
