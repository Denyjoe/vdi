"""SuperAdmin-only endpoints (IsSuperAdmin — real platform owner only,
distinct from regular platform admins). Phase 3 of the university layer."""
from django.urls import path
from .views import (
    SuperAdminUniversityListView,
    SuperAdminUniversityApproveView,
    SuperAdminUniversityRejectView,
    SuperAdminUniversitySuspendView,
    SuperAdminUniversityReactivateView,
    SuperAdminUniversityEditTermsView,
    SuperAdminUniversityDeleteView,
    SuperAdminUniversityInvoiceListView,
    SuperAdminUniversityInvoiceStatusView,
    SuperAdminUniversityRevenueView,
)

urlpatterns = [
    path('universities/', SuperAdminUniversityListView.as_view(), name='superadmin-university-list'),
    path('universities/<int:pk>/approve/', SuperAdminUniversityApproveView.as_view(), name='superadmin-university-approve'),
    path('universities/<int:pk>/reject/', SuperAdminUniversityRejectView.as_view(), name='superadmin-university-reject'),
    path('universities/<int:pk>/suspend/', SuperAdminUniversitySuspendView.as_view(), name='superadmin-university-suspend'),
    path('universities/<int:pk>/reactivate/', SuperAdminUniversityReactivateView.as_view(), name='superadmin-university-reactivate'),
    path('universities/<int:pk>/edit-terms/', SuperAdminUniversityEditTermsView.as_view(), name='superadmin-university-edit-terms'),
    path('universities/<int:pk>/delete/', SuperAdminUniversityDeleteView.as_view(), name='superadmin-university-delete'),
    path('invoices/', SuperAdminUniversityInvoiceListView.as_view(), name='superadmin-university-invoices'),
    path('invoices/<int:pk>/status/', SuperAdminUniversityInvoiceStatusView.as_view(), name='superadmin-university-invoice-status'),
    path('revenue/', SuperAdminUniversityRevenueView.as_view(), name='superadmin-university-revenue'),
]
