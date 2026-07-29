from django.urls import path
from . import views

urlpatterns = [
    path('', views.LiveSessionListView.as_view(), name='live-session-list'),
    path('pay-and-start/', views.PayAndStartSessionView.as_view(), name='live-session-pay-start'),
    path('discover/', views.PublicSessionsView.as_view(), name='live-session-discover'),
    path('join/', views.JoinSessionByCodeView.as_view(), name='live-session-join'),
    path('<int:pk>/', views.LiveSessionDetailView.as_view(), name='live-session-detail'),
    path('<int:pk>/start/', views.StartSessionView.as_view(), name='live-session-start'),
    path('<int:pk>/end/', views.EndSessionView.as_view(), name='live-session-end'),
    path('<int:pk>/monitor/', views.SessionMonitorView.as_view(), name='live-session-monitor'),
    path('<int:pk>/remove/<int:user_id>/', views.RemoveParticipantView.as_view(), name='live-session-remove-participant'),
    path('<int:pk>/control-participant/<int:participant_id>/', views.HostControlParticipantView.as_view(), name='live-session-control-participant'),
    path('<int:pk>/release-control/<int:participant_id>/', views.HostReleaseControlView.as_view(), name='live-session-release-control'),
    path('<int:pk>/leave/', views.LeaveSessionView.as_view(), name='live-session-leave'),
    path('<int:pk>/broadcast/', views.BroadcastMessageView.as_view(), name='live-session-broadcast'),
    path('<int:pk>/pause-all/', views.PauseAllParticipantsView.as_view(), name='live-session-pause-all'),
    path('<int:pk>/resume-all/', views.ResumeAllParticipantsView.as_view(), name='live-session-resume-all'),
    path('<int:pk>/extend/', views.ExtendSessionView.as_view(), name='live-session-extend'),
]
