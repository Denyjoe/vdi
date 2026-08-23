"""University Admin Dashboard endpoints (Phase 4) — gated by the real
can_manage_university/department/course functions per-object, not a
blanket role check. Distinct from superadmin_urls.py (platform owner)."""
from django.urls import path
from .admin_views import (
    MyUniversitiesView,
    DepartmentListCreateView,
    DepartmentDetailView,
    CourseListCreateView,
    CourseDetailView,
    BulkEnrollCSVView,
    DepartmentInviteListCreateView,
    InviteRedeemView,
    DepartmentLecturerGrantView,
    DepartmentLecturerRevokeView,
    UniversityLecturersView,
    UniversityAnalyticsView,
    UniversityHardwareView,
    UniversityTemplateLibraryView,
    UniversityOverviewView,
)
from .lecturer_views import MyCoursesView, CourseRosterView, CourseBroadcastView, MyCourseworkView
from .context_views import MyContextsView
from .template_request_views import (
    LecturerTemplateRequestListCreateView,
    TemplateRequestQuotaPreviewView,
    UniversityTemplateRequestListView,
    TemplateRequestApproveView,
    TemplateRequestRejectView,
)

urlpatterns = [
    path('universities/mine/', MyUniversitiesView.as_view(), name='university-admin-mine'),
    path('universities/<int:university_id>/departments/', DepartmentListCreateView.as_view(), name='university-admin-departments'),
    path('universities/<int:university_id>/enroll/bulk-csv/', BulkEnrollCSVView.as_view(), name='university-admin-bulk-csv'),
    path('universities/<int:university_id>/analytics/', UniversityAnalyticsView.as_view(), name='university-admin-analytics'),
    path('universities/<int:university_id>/overview/', UniversityOverviewView.as_view(), name='university-admin-overview'),
    path('universities/<int:university_id>/hardware/', UniversityHardwareView.as_view(), name='university-admin-hardware'),
    path('universities/<int:university_id>/lecturers/', UniversityLecturersView.as_view(), name='university-admin-lecturers'),
    path('universities/<int:university_id>/templates/', UniversityTemplateLibraryView.as_view(), name='university-admin-template-library'),
    path('departments/<int:department_id>/', DepartmentDetailView.as_view(), name='university-admin-department-detail'),
    path('departments/<int:department_id>/courses/', CourseListCreateView.as_view(), name='university-admin-courses'),
    path('departments/<int:department_id>/invites/', DepartmentInviteListCreateView.as_view(), name='university-admin-invites'),
    path('departments/<int:department_id>/lecturers/grant/', DepartmentLecturerGrantView.as_view(), name='university-admin-lecturer-grant'),
    path('departments/<int:department_id>/lecturers/revoke/', DepartmentLecturerRevokeView.as_view(), name='university-admin-lecturer-revoke'),
    path('courses/<int:course_id>/', CourseDetailView.as_view(), name='university-admin-course-detail'),
    path('invites/redeem/', InviteRedeemView.as_view(), name='university-admin-invite-redeem'),

    # Phase 5 — Lecturer Dashboard
    path('lecturer/my-courses/', MyCoursesView.as_view(), name='lecturer-my-courses'),
    path('lecturer/courses/<int:course_id>/roster/', CourseRosterView.as_view(), name='lecturer-course-roster'),

    # Phase 4 (Product Depth Layer) — scoped broadcast + student coursework
    path('lecturer/courses/<int:course_id>/broadcast/', CourseBroadcastView.as_view(), name='lecturer-course-broadcast'),
    path('student/my-coursework/', MyCourseworkView.as_view(), name='student-my-coursework'),

    # Phase 6 — Account Context Switching
    path('my-contexts/', MyContextsView.as_view(), name='university-my-contexts'),

    # Phase 2 (Product Depth Layer) — Template Request Workflow
    path('lecturer/template-requests/', LecturerTemplateRequestListCreateView.as_view(), name='lecturer-template-requests'),
    path('lecturer/template-requests/quota-preview/', TemplateRequestQuotaPreviewView.as_view(), name='lecturer-template-requests-quota-preview'),
    path('universities/<int:university_id>/template-requests/', UniversityTemplateRequestListView.as_view(), name='university-template-requests'),
    path('template-requests/<int:pk>/approve/', TemplateRequestApproveView.as_view(), name='university-template-requests-approve'),
    path('template-requests/<int:pk>/reject/', TemplateRequestRejectView.as_view(), name='university-template-requests-reject'),
]
