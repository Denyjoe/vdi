from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from apps.users.serializers import RegisterSerializer, UserProfileSerializer
from apps.classes.models import Group, GroupMembership
from apps.sessions.models import LiveSession, SessionParticipant
from apps.vms.models import Workspace, VirtualMachine

User = get_user_model()

class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"status": "ok"})

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        user = User.objects.filter(email=email).first()
        if user and user.check_password(password):
            if not user.is_active or not user.is_approved:
                return Response({
                    "success": False,
                    "message": "Account is inactive or pending approval"
                }, status=status.HTTP_401_UNAUTHORIZED)
                
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "success": True,
                "data": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": UserProfileSerializer(user).data
                }
            })
            
        return Response({
            "success": False,
            "message": "Invalid email or password"
        }, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"success": True})
        except Exception:
            return Response({
                "success": False,
                "message": "Invalid token"
            }, status=status.HTTP_400_BAD_REQUEST)

class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response({
            "success": True,
            "data": serializer.data
        })

class UpdateProfileView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user

class AvatarUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if 'avatar' not in request.FILES:
            return Response({"success": False, "message": "No avatar file provided"}, status=400)
            
        user.avatar = request.FILES['avatar']
        user.save()
        return Response({
            "success": True,
            "data": UserProfileSerializer(user).data
        })

class AvatarDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user
        if user.avatar:
            user.avatar.delete()
            user.save()
        return Response({"success": True})

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not user.check_password(old_password):
            return Response({"success": False, "message": "Incorrect old password"}, status=400)
            
        user.set_password(new_password)
        user.save()
        return Response({"success": True})

class UserStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        if user.role == 'member':
            data = {
                'role': 'member',
                'groups_joined': GroupMembership.objects.filter(user=user).count(),
                'sessions_joined': SessionParticipant.objects.filter(user=user).count(),
                'workspaces': Workspace.objects.filter(owner=user).count(),
                'total_vms': VirtualMachine.objects.filter(owner=user).count(),
                'hours_used_this_month': user.subscription.compute_hours_used if hasattr(user, 'subscription') else 0,
                'hours_remaining': user.subscription.hours_remaining if hasattr(user, 'subscription') else 0,
                'member_since': user.created_at
            }
        elif user.role == 'instructor':
            hosted_sessions = LiveSession.objects.filter(host=user)
            # count unique users across all hosted sessions
            total_participants = SessionParticipant.objects.filter(session__in=hosted_sessions).values('user').distinct().count()
            
            owned_groups = Group.objects.filter(created_by=user)
            total_members = GroupMembership.objects.filter(group__in=owned_groups).count()
            
            data = {
                'role': 'instructor',
                'groups_created': owned_groups.count(),
                'sessions_hosted': hosted_sessions.count(),
                'total_participants': total_participants,
                'total_members': total_members,
                'member_since': user.created_at
            }
        else:
            data = {'role': user.role, 'member_since': user.created_at}
            
        return Response({
            "success": True,
            "data": data
        })
