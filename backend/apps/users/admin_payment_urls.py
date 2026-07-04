from django.urls import path
from . import admin_payment_views

urlpatterns = [
    path('stats/', admin_payment_views.AdminPaymentStatsView.as_view(), name='admin-payment-stats'),
]
