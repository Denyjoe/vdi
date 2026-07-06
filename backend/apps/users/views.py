from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from apps.users.serializers import RegisterSerializer, UserProfileSerializer
from apps.sessions.models import LiveSession, SessionParticipant
from apps.vms.models import Workspace, VirtualMachine

User = get_user_model()

class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"status": "ok"})

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        if User.objects.filter(email=email).exists():
            return Response({
                'success': False,
                'message': 'An account with this email already exists'
            }, status=400)
            
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Setup verification
            import random
            code = str(random.randint(100000, 999999))
            user.is_verified = False
            user.verification_code = code
            user.save()
            
            logger.info(f"Verification code for {user.email}: {code}")
            
            return Response({
                'success': True,
                'message': 'Registration successful',
                'dev_code': code
            }, status=201)
        
        # Format errors
        error_msg = "Invalid data"
        if serializer.errors:
            first_error = list(serializer.errors.values())[0]
            error_msg = first_error[0] if isinstance(first_error, list) else first_error
            
        return Response({
            'success': False,
            'message': error_msg
        }, status=400)

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
            
            if not user.is_verified and user.role != 'admin' and not user.is_staff and not user.is_superuser:
                return Response({
                    "success": False,
                    "message": "Please verify your email first",
                    "needs_verification": True
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

import random
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        try:
            user = User.objects.get(email=email)
            code = str(random.randint(100000, 999999))
            user.password_reset_code = code
            user.password_reset_expires = timezone.now() + timedelta(minutes=30)
            user.save()
            
            logger.info(f"Password reset code for {email}: {code}")
            
            return Response({
                'success': True,
                'message': 'Reset code sent',
                'dev_code': code
            })
        except User.DoesNotExist:
            return Response({
                'success': True,
                'message': 'If this email is registered, a reset code has been sent'
            })

class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        code = request.data.get('code')
        new_password = request.data.get('new_password')
        
        try:
            user = User.objects.get(email=email)
            if user.password_reset_code != code or not user.password_reset_expires or user.password_reset_expires < timezone.now():
                return Response({
                    'success': False,
                    'message': 'Invalid or expired code'
                }, status=400)
            
            user.set_password(new_password)
            user.password_reset_code = ''
            user.password_reset_expires = None
            user.save()
            
            return Response({
                'success': True,
                'message': 'Password reset successfully'
            })
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Invalid request'
            }, status=400)

class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        code = request.data.get('code')
        try:
            user = User.objects.get(email=email)
            if user.is_verified:
                return Response({'success': True, 'message': 'Email already verified'})
                
            if user.verification_code == code:
                user.is_verified = True
                user.verification_code = ''
                user.save()
                return Response({'success': True, 'message': 'Email verified successfully'})
            else:
                return Response({'success': False, 'message': 'Invalid verification code'}, status=400)
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'User not found'}, status=404)

class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        try:
            user = User.objects.get(email=email)
            if user.is_verified:
                return Response({'success': False, 'message': 'Email already verified'}, status=400)
                
            code = str(random.randint(100000, 999999))
            user.verification_code = code
            user.save()
            
            logger.info(f"Verification code for {email}: {code}")
            
            return Response({
                'success': True, 
                'message': 'Verification code resent',
                'dev_code': code
            })
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'User not found'}, status=404)


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

class PricingView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from apps.users.models import SubscriptionPlan
        from apps.vms.models import VMTemplate
        from apps.vms.serializers import VMTemplateSerializer
        
        plans = SubscriptionPlan.objects.all().values()
        templates = VMTemplate.objects.filter(is_available=True)
        return Response({
            "success": True,
            "data": {
                "plans": list(plans),
                "templates": VMTemplateSerializer(templates, many=True).data
            }
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


class GoogleAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        access_token = request.data.get('access_token')
        user_info = request.data.get('user_info')

        if not access_token or not user_info:
            return Response({'success': False, 'message': 'Missing token or user info'}, status=400)

        try:
            import requests as http_requests
            verify_url = f'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token={access_token}'
            verify_res = http_requests.get(verify_url)

            if verify_res.status_code != 200:
                return Response({'success': False, 'message': 'Invalid Google token'}, status=400)

            email = user_info.get('email')
            first_name = user_info.get('given_name', '')
            last_name = user_info.get('family_name', '')
            is_verified = user_info.get('email_verified', False)

            if not email:
                return Response({'success': False, 'message': 'No email from Google'}, status=400)

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'username': email,
                    'role': 'member',
                    'is_verified': is_verified,
                }
            )

            if created:
                user.set_unusable_password()
                user.save()

                from apps.users.models import SubscriptionPlan, UserSubscription, ActivityLog
                free_plan = SubscriptionPlan.objects.get(name='free')
                UserSubscription.objects.create(user=user, plan=free_plan, status='active')

                ActivityLog.objects.create(user=user, action='USER_REGISTERED_GOOGLE', description=f'Google signup: {email}')
            else:
                from apps.users.models import ActivityLog
                ActivityLog.objects.create(user=user, action='USER_LOGIN_GOOGLE', description=f'Google login: {email}')

            refresh = RefreshToken.for_user(user)

            return Response({
                'success': True,
                'data': {
                    'user': UserProfileSerializer(user, context={'request': request}).data,
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                    'is_new_user': created
                },
                'message': 'Welcome to CloudDesk!'
            })

        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)
