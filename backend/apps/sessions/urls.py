from django.urls import path
from . import views

urlpatterns = [
    path('connect/', views.ConnectSessionView.as_view(), name='connect_session'),
    path('<int:pk>/disconnect/', views.DisconnectSessionView.as_view(), name='disconnect_session'),
    path('my-sessions/', views.MySessionsView.as_view(), name='my_sessions'),
    path('active/', views.ActiveSessionView.as_view(), name='active_session'),
    path('lecturer/active/', views.LecturerActiveSessionsView.as_view(), name='lecturer_active_sessions'),
    path('lecturer/terminate/<int:pk>/', views.LecturerTerminateSessionView.as_view(), name='lecturer_terminate_session'),
]
