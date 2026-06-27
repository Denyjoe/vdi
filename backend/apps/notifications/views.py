from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Notification
from .serializers import NotificationSerializer

class NotificationListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user)
        serializer = NotificationSerializer(notifications, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Notifications retrieved successfully"
        }, status=status.HTTP_200_OK)

class MarkReadView(views.APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
            notification.is_read = True
            notification.save()
            return Response({
                "success": True,
                "data": NotificationSerializer(notification).data,
                "message": "Notification marked as read"
            }, status=status.HTTP_200_OK)
        except Notification.DoesNotExist:
            return Response({
                "success": False,
                "error": "Notification not found",
                "message": "Failed to mark as read"
            }, status=status.HTTP_404_NOT_FOUND)

class MarkAllReadView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({
            "success": True,
            "data": {},
            "message": "All notifications marked as read"
        }, status=status.HTTP_200_OK)
