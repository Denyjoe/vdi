from django.urls import path
from . import admin_views

urlpatterns = [
    path('templates/<int:pk>/pricing/', admin_views.AdminTemplatePricingView.as_view(), name='admin-template-pricing'),
]
