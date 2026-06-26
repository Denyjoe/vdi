"""
URL configuration for the classes application.

Covers:
- Class management (lecturer + admin)
- Enrollment requests (student + lecturer)
- Academic structure (departments, programmes, streams)
- Practical session management
"""

from django.urls import path
from . import views

urlpatterns = [
    # ── General & Enrolled ───────────────────────────────────────────────
    path('my-classes/', views.MyClassesView.as_view(), name='my_classes'),
    path('enrolled/', views.StudentEnrolledClassesView.as_view(), name='enrolled_classes'),

    # ── Lecturer: Class Management ───────────────────────────────────────
    path('create/', views.LecturerCreateClassView.as_view(), name='class_create'),
    path('<int:pk>/update/', views.LecturerUpdateClassView.as_view(), name='class_update'),
    path('<int:pk>/', views.ClassDetailView.as_view(), name='class_detail'),
    path('<int:pk>/students/', views.ClassEnrollmentListView.as_view(), name='class_students'),
    path('<int:pk>/students/<int:student_id>/', views.LecturerRemoveStudentView.as_view(), name='class_student_remove'),

    # ── Lecturer: Enrollment Requests ────────────────────────────────────
    path('<int:pk>/requests/', views.LecturerEnrollmentRequestsView.as_view(), name='class_requests'),
    path('requests/<int:pk>/approve/', views.LecturerApproveEnrollmentView.as_view(), name='class_request_approve'),
    path('requests/<int:pk>/reject/', views.LecturerRejectEnrollmentView.as_view(), name='class_request_reject'),

    # ── Student: Enrollment ──────────────────────────────────────────────
    path('available/', views.StudentAvailableClassesView.as_view(), name='student_available_classes'),
    path('<int:pk>/request/', views.StudentRequestEnrollmentView.as_view(), name='student_request_enrollment'),
    path('requests/<int:pk>/cancel/', views.StudentCancelRequestView.as_view(), name='student_cancel_request'),
    path('my-requests/', views.StudentMyRequestsView.as_view(), name='student_my_requests'),

    # ── Academic Structure (GET for dropdowns) ───────────────────────────
    path('departments/', views.DepartmentListView.as_view(), name='departments'),
    path('programmes/', views.ProgrammeListView.as_view(), name='programmes'),
    path('streams/', views.CourseStreamListView.as_view(), name='course_streams'),

]
