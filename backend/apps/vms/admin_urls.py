from django.urls import path
from . import admin_views
from . import template_wizard_views as wizard

urlpatterns = [
    # ── Admin OS/Template Management wizard ──────────────────────────
    path('templates/available-isos/', wizard.AdminAvailableISOsView.as_view(), name='admin-template-available-isos'),
    path('templates/desktop-environments/', wizard.AdminDesktopEnvironmentProfilesView.as_view(), name='admin-template-desktop-environments'),
    path('templates/create-job/', wizard.AdminTemplateJobCreateView.as_view(), name='admin-template-create-job'),
    path('templates/jobs/<int:pk>/', wizard.AdminTemplateJobDetailView.as_view(), name='admin-template-job-detail'),
    path('templates/jobs/<int:pk>/apply-configuration/', wizard.AdminTemplateJobApplyConfigurationView.as_view(), name='admin-template-job-apply-configuration'),
    path('templates/jobs/<int:pk>/install-apps/', wizard.AdminTemplateJobInstallAppsView.as_view(), name='admin-template-job-install-apps'),
    path('templates/jobs/<int:pk>/finalize/', wizard.AdminTemplateJobFinalizeView.as_view(), name='admin-template-job-finalize'),
    path('templates/jobs/<int:pk>/verify/', wizard.AdminTemplateJobVerifyView.as_view(), name='admin-template-job-verify'),
    path('templates/jobs/<int:pk>/promote/', wizard.AdminTemplateJobPromoteView.as_view(), name='admin-template-job-promote'),
    path('templates/jobs/<int:pk>/open-terminal/', wizard.AdminTemplateJobOpenTerminalView.as_view(), name='admin-template-job-open-terminal'),
    path('templates/jobs/<int:pk>/open-console/', wizard.AdminTemplateJobOpenConsoleView.as_view(), name='admin-template-job-open-console'),
    path('vms/<int:proxmox_vmid>/open-terminal/', wizard.AdminVMOpenTerminalView.as_view(), name='admin-vm-open-terminal'),

    path('templates/<int:pk>/pricing/', admin_views.AdminTemplatePricingView.as_view(), name='admin-template-pricing'),
    path('workspaces/', admin_views.AdminWorkspacesListView.as_view(), name='admin-workspaces-list'),
    path('workspaces/<int:workspace_id>/force-stop/', admin_views.AdminForceStopWorkspaceView.as_view(), name='admin-workspaces-force-stop'),
    path('workspaces/<int:workspace_id>/', admin_views.AdminDeleteWorkspaceView.as_view(), name='admin-workspaces-delete'),
    path('workspaces/bulk/', admin_views.AdminBulkWorkspaceView.as_view(), name='admin-workspaces-bulk'),
    path('workspaces/<int:workspace_id>/detail/', admin_views.AdminWorkspaceDetailView.as_view(), name='admin-workspaces-detail'),
    path('hardware/', admin_views.AdminHardwareView.as_view(), name='admin-hardware'),
    path('hardware/cpu-history/', admin_views.AdminHardwareCpuHistoryView.as_view(), name='admin-hardware-cpu-history'),
    path('idle-workspaces/summary/', admin_views.AdminIdleWorkspacesSummaryView.as_view(), name='admin-idle-workspaces-summary'),
    path('idle-workspaces/run-check/', admin_views.AdminRunIdleCheckView.as_view(), name='admin-idle-workspaces-run-check'),
    path('infrastructure/drift-report/', admin_views.AdminInfrastructureDriftReportView.as_view(), name='admin-infrastructure-drift-report'),
    path('infrastructure/resolve-orphan/', admin_views.AdminResolveOrphanView.as_view(), name='admin-infrastructure-resolve-orphan'),
    path('infrastructure/resolve-stale/', admin_views.AdminResolveStaleView.as_view(), name='admin-infrastructure-resolve-stale'),
]
