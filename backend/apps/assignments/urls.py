from django.urls import path
from . import views

urlpatterns = [
    # Files
    path('files/upload/', views.LecturerFileUploadView.as_view(), name='file-upload'),
    path('files/<int:class_id>/', views.ClassFilesListView.as_view(), name='class-files-list'),
    path('files/<int:file_id>/', views.FileDeleteView.as_view(), name='file-delete'),

    # Lecturer Assignments
    path('lecturer/', views.LecturerAssignmentListView.as_view(), name='lecturer-assignments'),
    path('create/', views.LecturerAssignmentCreateView.as_view(), name='assignment-create'),
    path('<int:pk>/', views.LecturerAssignmentDetailView.as_view(), name='assignment-detail'),
    
    # Lecturer Submissions
    path('<int:assignment_id>/submissions/', views.LecturerSubmissionsView.as_view(), name='lecturer-submissions'),
    path('submissions/<int:pk>/download/', views.LecturerDownloadSubmissionView.as_view(), name='submission-download'),

    # Student Assignments & Submissions
    path('student/', views.StudentAssignmentListView.as_view(), name='student-assignments'),
    path('submit/', views.StudentSubmitView.as_view(), name='assignment-submit'),
    path('my-submissions/', views.StudentSubmissionsView.as_view(), name='student-submissions'),
]
