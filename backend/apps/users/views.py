from rest_framework import views, status, generics
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from apps.sessions.models import ActivityLog

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    UpdateProfileSerializer,
    ChangePasswordSerializer,
    ActivityLogSerializer
)
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import os

User = get_user_model()

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

class RegisterView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            tokens = get_tokens_for_user(user)
            profile_data = UserProfileSerializer(user, context={'request': request}).data
            
            ActivityLog.objects.create(
                user=user,
                action='USER_REGISTERED',
                ip_address=request.META.get('REMOTE_ADDR'),
                metadata={'email': user.email, 'role': user.role}
            )

            return Response({
                "success": True,
                "data": {
                    "user": profile_data,
                    "access": tokens['access'],
                    "refresh": tokens['refresh']
                },
                "message": "Registration successful"
            }, status=status.HTTP_201_CREATED)
            
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "Registration failed"
        }, status=status.HTTP_400_BAD_REQUEST)

class LoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            tokens = get_tokens_for_user(user)
            profile_data = UserProfileSerializer(user, context={'request': request}).data
            
            ActivityLog.objects.create(
                user=user,
                action='USER_LOGIN',
                ip_address=request.META.get('REMOTE_ADDR'),
                metadata={'email': user.email}
            )

            return Response({
                "success": True,
                "data": {
                    "user": profile_data,
                    "access": tokens['access'],
                    "refresh": tokens['refresh']
                },
                "message": "Login successful"
            }, status=status.HTTP_200_OK)
            
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "Login failed"
        }, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response({
                    "success": False, 
                    "error": "Refresh token is required", 
                    "message": "Logout failed"
                }, status=status.HTTP_400_BAD_REQUEST)

            token = RefreshToken(refresh_token)
            token.blacklist()
            
            ActivityLog.objects.create(
                user=request.user,
                action='USER_LOGOUT',
                ip_address=request.META.get('REMOTE_ADDR'),
                metadata={'email': request.user.email}
            )

            return Response({
                "success": True,
                "data": {},
                "message": "Logged out"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "success": False,
                "error": str(e),
                "message": "Logout failed"
            }, status=status.HTTP_400_BAD_REQUEST)

class MeView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Profile retrieved"
        }, status=status.HTTP_200_OK)
        
    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "Profile updated"
            }, status=status.HTTP_200_OK)
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "Profile update failed"
        }, status=status.HTTP_400_BAD_REQUEST)

class ChangePasswordView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            ActivityLog.objects.create(
                user=user,
                action='PASSWORD_CHANGED',
                ip_address=request.META.get('REMOTE_ADDR')
            )

            return Response({
                "success": True,
                "data": {},
                "message": "Password changed successfully"
            }, status=status.HTTP_200_OK)
            
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "Password change failed"
        }, status=status.HTTP_400_BAD_REQUEST)

# ── Profile Updates & Stats ───────────────────────────────────────────────────

class UpdateProfileView(views.APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request):
        serializer = UpdateProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            ActivityLog.objects.create(
                user=request.user,
                action='PROFILE_UPDATED',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            # Return full profile
            profile_data = UserProfileSerializer(request.user, context={'request': request}).data
            return Response({
                "success": True,
                "data": profile_data,
                "message": "Profile updated successfully"
            }, status=status.HTTP_200_OK)
            
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "Profile update failed"
        }, status=status.HTTP_400_BAD_REQUEST)


class AvatarView(views.APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if 'avatar' not in request.FILES:
            return Response({
                "success": False,
                "error": "No avatar file provided",
                "message": "Avatar upload failed"
            }, status=status.HTTP_400_BAD_REQUEST)
            
        avatar_file = request.FILES['avatar']
        
        # Validation using UpdateProfileSerializer
        serializer = UpdateProfileSerializer(request.user, data={'avatar': avatar_file}, partial=True)
        if not serializer.is_valid():
            return Response({
                "success": False,
                "error": serializer.errors,
                "message": "Avatar validation failed"
            }, status=status.HTTP_400_BAD_REQUEST)

        # Delete old avatar from disk
        user = request.user
        if user.avatar:
            path = user.avatar.path
            if os.path.isfile(path):
                os.remove(path)
                
        user.avatar = avatar_file
        user.save()
        
        ActivityLog.objects.create(
            user=user,
            action='AVATAR_UPDATED',
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        url = request.build_absolute_uri(user.avatar.url)
        return Response({
            "success": True,
            "data": {"avatar_url": url},
            "message": "Avatar uploaded successfully"
        }, status=status.HTTP_200_OK)

    def delete(self, request):
        user = request.user
        if user.avatar:
            path = user.avatar.path
            if os.path.isfile(path):
                os.remove(path)
            user.avatar = None
            user.save()
            
            ActivityLog.objects.create(
                user=user,
                action='AVATAR_DELETED',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
        return Response({
            "success": True,
            "data": {},
            "message": "Avatar removed successfully"
        }, status=status.HTTP_200_OK)


class UserStatsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        if user.is_student:
            from apps.classes.models import ClassEnrollment
            from apps.vms.models import VirtualMachine
            from apps.sessions.models import RemoteSession, StudentPracticalAccess
            from apps.assignments.models import Submission
            
            enrolled = ClassEnrollment.objects.filter(student=user).count()
            total_vms = VirtualMachine.objects.filter(owner=user).exclude(status='deleted').count()
            sessions = RemoteSession.objects.filter(user=user)
            total_sessions = sessions.count()
            total_hours = round(sum(s.duration_seconds or 0 for s in sessions) / 3600, 1)
            submitted = Submission.objects.filter(student=user).count()
            practicals_submitted = StudentPracticalAccess.objects.filter(student=user, submission_file__isnull=False).count()
            
            return Response({
                "success": True,
                "data": {
                    "role": "student",
                    "enrolled_classes": enrolled,
                    "total_vms": total_vms,
                    "total_sessions": total_sessions,
                    "total_session_hours": total_hours,
                    "assignments_submitted": submitted,
                    "practicals_submitted": practicals_submitted,
                    "member_since": user.created_at.isoformat()
                },
                "message": "Stats retrieved"
            }, status=status.HTTP_200_OK)

        elif user.is_lecturer:
            from apps.classes.models import Class, ClassEnrollment
            from apps.assignments.models import Assignment, Submission
            from apps.sessions.models import ExamSession, PracticalSession
            from django.db import models
            
            classes = Class.objects.filter(models.Q(lecturer=user) | models.Q(created_by=user)).distinct()
            class_ids = classes.values_list('id', flat=True)
            unique_students = ClassEnrollment.objects.filter(class_room_id__in=class_ids).values('student').distinct().count()
            total_assignments = Assignment.objects.filter(class_room_id__in=class_ids).count()
            total_submissions = Submission.objects.filter(assignment__class_room_id__in=class_ids).count()
            practicals = PracticalSession.objects.filter(lecturer=user).count()
            exams = ExamSession.objects.filter(lecturer=user).count()
            
            return Response({
                "success": True,
                "data": {
                    "role": "lecturer",
                    "total_classes": classes.count(),
                    "total_students": unique_students,
                    "total_assignments": total_assignments,
                    "total_submissions": total_submissions,
                    "practicals_conducted": practicals,
                    "exams_conducted": exams,
                    "member_since": user.created_at.isoformat()
                },
                "message": "Stats retrieved"
            }, status=status.HTTP_200_OK)

        elif user.is_admin_user:
            from apps.vms.models import VirtualMachine, VMTemplate
            from apps.sessions.models import RemoteSession
            
            return Response({
                "success": True,
                "data": {
                    "role": "admin",
                    "total_users": User.objects.count(),
                    "total_vms": VirtualMachine.objects.exclude(status='deleted').count(),
                    "total_sessions": RemoteSession.objects.count(),
                    "total_templates": VMTemplate.objects.count(),
                    "member_since": user.created_at.isoformat()
                },
                "message": "Stats retrieved"
            }, status=status.HTTP_200_OK)
            
        return Response({"success": False, "error": "Unknown role"}, status=status.HTTP_400_BAD_REQUEST)

from .permissions import IsAdmin
from django.db.models import Q

class UserListView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        queryset = User.objects.all().order_by('-created_at')
        
        role = request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
            
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) | 
                Q(last_name__icontains=search) | 
                Q(email__icontains=search)
            )
            
        serializer = UserProfileSerializer(queryset, many=True, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Users retrieved successfully"
        }, status=status.HTTP_200_OK)

class UserDetailView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            serializer = UserProfileSerializer(user, context={'request': request})
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "User retrieved successfully"
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({
                "success": False,
                "error": "User not found",
                "message": "Failed to retrieve user"
            }, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            allowed_fields = ['role', 'is_approved', 'is_active', 'phone']
            data = {k: v for k, v in request.data.items() if k in allowed_fields}
            
            for key, value in data.items():
                setattr(user, key, value)
            user.save()
            
            serializer = UserProfileSerializer(user, context={'request': request})
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "User updated successfully"
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({
                "success": False,
                "error": "User not found",
                "message": "Update failed"
            }, status=status.HTTP_404_NOT_FOUND)

class UserDeactivateView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            user.is_active = False
            user.save()
            
            ActivityLog.objects.create(
                user=request.user,
                action='USER_DEACTIVATED',
                ip_address=request.META.get('REMOTE_ADDR'),
                metadata={'target_user_id': user.id, 'target_email': user.email}
            )
            
            serializer = UserProfileSerializer(user, context={'request': request})
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "User deactivated"
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({
                "success": False,
                "error": "User not found",
                "message": "Deactivation failed"
            }, status=status.HTTP_404_NOT_FOUND)

class UserActivateView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            user.is_active = True
            user.save()
            
            ActivityLog.objects.create(
                user=request.user,
                action='USER_ACTIVATED',
                ip_address=request.META.get('REMOTE_ADDR'),
                metadata={'target_user_id': user.id, 'target_email': user.email}
            )
            
            serializer = UserProfileSerializer(user, context={'request': request})
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "User activated"
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({
                "success": False,
                "error": "User not found",
                "message": "Activation failed"
            }, status=status.HTTP_404_NOT_FOUND)

class AdminLogsView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # Return last 20 entries
        logs = ActivityLog.objects.all().order_by('-timestamp')[:20]
        serializer = ActivityLogSerializer(logs, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Logs retrieved successfully"
        }, status=status.HTTP_200_OK)

class HealthCheckView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "success": True,
            "data": {},
            "message": "API is healthy"
        }, status=status.HTTP_200_OK)
