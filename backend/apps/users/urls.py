from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('me/', views.MeView.as_view(), name='me'),
    path('me/update/', views.UpdateProfileView.as_view(), name='update-profile'),
    path('me/avatar/upload/', views.AvatarUploadView.as_view(), name='upload-avatar'),
    path('me/avatar/delete/', views.AvatarDeleteView.as_view(), name='delete-avatar'),
    path('me/change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('stats/', views.UserStatsView.as_view(), name='user-stats'),
]
