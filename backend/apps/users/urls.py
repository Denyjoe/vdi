from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('google/', views.GoogleAuthView.as_view(), name='google-auth'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('me/', views.MeView.as_view(), name='me'),
    path('me/update/', views.UpdateProfileView.as_view(), name='update-profile'),
    path('me/avatar/upload/', views.AvatarUploadView.as_view(), name='upload-avatar'),
    path('me/avatar/delete/', views.AvatarDeleteView.as_view(), name='delete-avatar'),
    path('me/change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('stats/', views.UserStatsView.as_view(), name='user-stats'),
    path('account/', views.UpdateProfileView.as_view(), name='account-update'),
    path('password-reset/request/', views.PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('verify-email/', views.VerifyEmailView.as_view(), name='verify-email'),
    path('resend-verification/', views.ResendVerificationView.as_view(), name='resend-verification'),
    
    # Account Settings Endpoints
    path('profile/', views.ProfileUpdateView.as_view(), name='profile-update'),
    path('avatar/', views.AvatarUploadView.as_view(), name='avatar-upload'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password-new'),
    path('notification-preferences/', views.NotificationPreferencesView.as_view(), name='notification-preferences'),
    path('api-token/', views.APITokenView.as_view(), name='api-token'),
    path('api-token/generate/', views.APITokenGenerateView.as_view(), name='api-token-generate'),
    path('api-token/revoke/', views.APITokenRevokeView.as_view(), name='api-token-revoke'),
    path('delete-account/', views.DeleteAccountView.as_view(), name='delete-account'),
]
