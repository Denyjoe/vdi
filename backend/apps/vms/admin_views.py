from rest_framework import views, status, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import VMTemplate
from .serializers import VMTemplateSerializer

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')

class AdminTemplatePricingView(views.APIView):
    permission_classes = [IsAdminUser]

    def put(self, request, pk):
        template = get_object_or_404(VMTemplate, pk=pk)
        
        if 'price_per_hour' in request.data:
            template.price_per_hour = request.data['price_per_hour']
        if 'monthly_cap' in request.data:
            template.monthly_cap = request.data['monthly_cap']
        if 'is_available' in request.data:
            template.is_available = request.data['is_available']
            
        template.save()
        
        return Response({
            "success": True,
            "data": VMTemplateSerializer(template).data,
            "message": "Template pricing updated"
        })
