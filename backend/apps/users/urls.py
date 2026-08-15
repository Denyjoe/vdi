from django.urls import path
from . import views

urlpatterns = [
    path('firebase-login/', views.FirebaseLoginView.as_view(), name='firebase-login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('me/', views.MeView.as_view(), name='me'),
    path('me/update/', views.UpdateProfileView.as_view(), name='update-profile'),
    path('me/avatar/upload/', views.AvatarUploadView.as_view(), name='upload-avatar'),
    path('me/avatar/delete/', views.AvatarDeleteView.as_view(), name='delete-avatar'),
    path('stats/', views.UserStatsView.as_view(), name='user-stats'),
    path('account/', views.UpdateProfileView.as_view(), name='account-update'),
    
    # Account Settings Endpoints
    path('profile/', views.ProfileUpdateView.as_view(), name='profile-update'),
    path('profile/stats/', views.ProfileStatsView.as_view(), name='profile-stats'),
    path('avatar/', views.AvatarUploadView.as_view(), name='avatar-upload'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password-new'),
    path('notification-preferences/', views.NotificationPreferencesView.as_view(), name='notification-preferences'),
    path('api-token/', views.APITokenView.as_view(), name='api-token'),
    path('api-token/generate/', views.APITokenGenerateView.as_view(), name='api-token-generate'),
    path('api-token/revoke/', views.APITokenRevokeView.as_view(), name='api-token-revoke'),
    path('delete-account/', views.DeleteAccountView.as_view(), name='delete-account'),
    path('sessions/', views.SessionListView.as_view(), name='session-list'),
    path('sessions/<int:pk>/revoke/', views.SessionRevokeView.as_view(), name='session-revoke'),
    path('sessions/revoke-all/', views.SessionRevokeAllView.as_view(), name='session-revoke-all'),
]
