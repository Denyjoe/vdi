from django.urls import path
from .payment_views import (
  InitiatePaymentView,
  PaymentCallbackView,
  CheckPaymentStatusView,
  PaymentHistoryView
)

urlpatterns = [
  path('initiate/', 
    InitiatePaymentView.as_view()),
  path('callback/', 
    PaymentCallbackView.as_view()),
  path('status/<str:transaction_id>/', 
    CheckPaymentStatusView.as_view()),
  path('history/', 
    PaymentHistoryView.as_view()),
]
