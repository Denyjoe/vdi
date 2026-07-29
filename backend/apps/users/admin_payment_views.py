from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from apps.users.permissions import IsAdmin
from apps.users.models import Payment
from django.db.models import Sum

class AdminPaymentStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    def get(self, request):
        total_revenue = Payment.objects.filter(status='completed').aggregate(total=Sum('amount_tzs'))['total'] or 0
        total_transactions = Payment.objects.count()
        successful_transactions = Payment.objects.filter(status='completed').count()
        
        return Response({
            "success": True,
            "data": {
                "total_revenue_tzs": total_revenue,
                "total_transactions": total_transactions,
                "successful_transactions": successful_transactions
            }
        })
