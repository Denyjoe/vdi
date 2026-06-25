from rest_framework import generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsLecturer, IsAdmin
from .models import Class, ClassEnrollment
from .serializers import ClassSerializer, ClassEnrollmentSerializer
from django.db.models import Count

class MyClassesView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = ClassSerializer

    def get_queryset(self):
        # Return classes where lecturer == request.user
        return Class.objects.filter(lecturer=self.request.user).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

class ClassDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ClassSerializer

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Class.objects.all()
        elif self.request.user.role == 'lecturer':
            return Class.objects.filter(lecturer=self.request.user)
        else:
            return Class.objects.filter(enrollments__student=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        
        # Add enrolled students list
        enrollments = instance.enrollments.all()
        enrollment_serializer = ClassEnrollmentSerializer(enrollments, many=True)
        data['enrolled_students'] = enrollment_serializer.data
        
        return Response({"success": True, "data": data})

class ClassEnrollmentListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ClassEnrollmentSerializer

    def get_queryset(self):
        class_id = self.kwargs['pk']
        return ClassEnrollment.objects.filter(class_room_id=class_id).order_by('-enrolled_at')
        
    def list(self, request, *args, **kwargs):
        # Verify permissions: must be admin or the lecturer of the class
        class_room = Class.objects.filter(id=self.kwargs['pk']).first()
        if not class_room:
            return Response({"success": False, "message": "Class not found"}, status=404)
            
        if request.user.role != 'admin' and class_room.lecturer != request.user:
            return Response({"success": False, "message": "Not authorized"}, status=403)
            
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

class AdminClassListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = ClassSerializer

    def get_queryset(self):
        return Class.objects.all().order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


class StudentEnrolledClassesView(generics.ListAPIView):
    """Returns all classes a student is enrolled in."""
    permission_classes = [IsAuthenticated]
    serializer_class = ClassSerializer

    def get_queryset(self):
        return Class.objects.filter(
            enrollments__student=self.request.user,
            is_active=True
        ).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})
