from django.urls import path
from . import views

urlpatterns = [
    path('overview/', views.BillingOverviewView.as_view()),
    path('usage/', views.UsageHistoryView.as_view()),
    path('payments/', views.PaymentHistoryView.as_view()),
    path('receipt/<int:payment_id>/', views.ReceiptDownloadView.as_view()),
]
