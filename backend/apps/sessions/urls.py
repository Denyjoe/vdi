from django.urls import path
from . import views

urlpatterns = [
    path('connect/', views.ConnectSessionView.as_view(), name='connect_session'),
    path('<int:pk>/disconnect/', views.DisconnectSessionView.as_view(), name='disconnect_session'),
    path('my-sessions/', views.MySessionsView.as_view(), name='my_sessions'),
    path('active/', views.ActiveSessionView.as_view(), name='active_session'),
    path('lecturer/active/', views.LecturerActiveSessionsView.as_view(), name='lecturer_active_sessions'),
    path('lecturer/terminate/<int:pk>/', views.LecturerTerminateSessionView.as_view(), name='lecturer_terminate_session'),
    path('exam-sessions/', views.LecturerExamSessionListCreateView.as_view(), name='exam_session_list_create'),
    path('exam-sessions/active/', views.StudentActiveExamSessionView.as_view(), name='student_active_exam_session'),
    path('exam-sessions/<int:pk>/', views.LecturerExamSessionDetailView.as_view(), name='exam_session_detail'),
    path('exam-sessions/<int:pk>/start/', views.LecturerStartExamView.as_view(), name='exam_session_start'),
    path('exam-sessions/<int:pk>/end/', views.LecturerEndExamView.as_view(), name='exam_session_end'),
    path('lecturer/monitor/', views.LecturerMonitorView.as_view(), name='lecturer_monitor'),
]
