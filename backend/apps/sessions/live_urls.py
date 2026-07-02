from django.urls import path
from . import views

urlpatterns = [
    path('', views.LiveSessionListView.as_view(), name='live-session-list'),
    path('create/', views.LiveSessionCreateView.as_view(), name='live-session-create'),
    path('discover/', views.PublicSessionsView.as_view(), name='live-session-discover'),
    path('join/', views.JoinSessionByCodeView.as_view(), name='live-session-join'),
    path('<int:pk>/', views.LiveSessionDetailView.as_view(), name='live-session-detail'),
    path('<int:pk>/start/', views.StartSessionView.as_view(), name='live-session-start'),
    path('<int:pk>/end/', views.EndSessionView.as_view(), name='live-session-end'),
    path('<int:pk>/monitor/', views.SessionMonitorView.as_view(), name='live-session-monitor'),
    path('<int:pk>/remove/<int:user_id>/', views.RemoveParticipantView.as_view(), name='live-session-remove-participant'),
]
