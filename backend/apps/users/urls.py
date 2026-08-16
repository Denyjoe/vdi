from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Real audit finding: frontend's axios interceptor (services/api.js)
    # has always called POST /api/auth/token/refresh/ to silently refresh
    # an expired access token, but no route for it was ever registered
    # anywhere in the backend - every real request confirmed this 404s.
    # With an 8-hour ACCESS_TOKEN_LIFETIME, every authenticated user was
    # being forcibly logged out (both tokens cleared, redirected to
    # /login) the moment their access token expired, even with a fully
    # valid, unexpired refresh token. Wiring in DRF SimpleJWT's own
    # TokenRefreshView - it already returns exactly the
    # {"access": "..."} shape api.js's interceptor expects.
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
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
