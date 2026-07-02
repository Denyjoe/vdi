from django.urls import path
from . import views

urlpatterns = [
  # VM Templates (PUBLIC - any auth user)
  path('templates/', 
    views.VMTemplateListView.as_view(),
    name='vm-templates'),
  path('templates/<int:pk>/', 
    views.VMTemplateDetailView.as_view(),
    name='vm-template-detail'),
    
  # User's VMs
  path('my-vms/', 
    views.VMListView.as_view(),
    name='my-vms'),
  path('request/', 
    views.VMRequestView.as_view(),
    name='vm-request'),
  path('<int:pk>/', 
    views.VMDetailView.as_view(),
    name='vm-detail'),
  path('<int:pk>/status/', 
    views.VMStatusView.as_view(),
    name='vm-status'),
  path('<int:pk>/stop/', 
    views.VMStopView.as_view(),
    name='vm-stop'),
  path('<int:pk>/start/', 
    views.VMStartView.as_view(),
    name='vm-start'),
  path('<int:pk>/delete/', 
    views.VMDeleteView.as_view(),
    name='vm-delete'),
]
