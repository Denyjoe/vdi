from django.urls import path
from . import admin_views

urlpatterns = [
    path('stats/', admin_views.AdminSessionStatsView.as_view(), name='admin-session-stats'),
    path('live/', admin_views.AdminLiveSessionsView.as_view(), name='admin-live-sessions'),
    path('<int:session_id>/monitor/', admin_views.AdminSessionMonitorView.as_view(), name='admin-session-monitor'),
    path('<int:session_id>/disconnect-participant/', admin_views.AdminDisconnectParticipantView.as_view(), name='admin-disconnect-participant'),
    path('<int:session_id>/force-end/', admin_views.AdminForceEndSessionView.as_view(), name='admin-force-end-session'),
    path('message/', admin_views.AdminSendMessageView.as_view(), name='admin-send-message'),
    path('<int:session_id>/recording/', admin_views.AdminToggleRecordingView.as_view(), name='admin-toggle-recording'),
]
