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
        from apps.users.models import SystemConfig

        allow_reg = str(SystemConfig.get('allow_registration', 'true')).lower()
        if allow_reg == 'false':
            return Response({
                'success': False,
                'message': 'New account registration is currently disabled. Please contact support@clouddesk.io'
            }, status=403)

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
        
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ',' in ip:
            ip = ip.split(',')[0].strip()
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255]
        
        from apps.users.models import LoginAttempt
        
        user = User.objects.filter(email=email).first()
        if user and user.check_password(password):
            if user.is_suspended:
                LoginAttempt.objects.create(email=email, success=False, ip_address=ip, user_agent=user_agent)
                return Response({
                    'success': False,
                    'message': (
                        'Your account has been '
                        'suspended. Contact support '
                        'at support@clouddesk.io')
                }, status=403)
                
            if not user.is_active or not user.is_approved:
                LoginAttempt.objects.create(email=email, success=False, ip_address=ip, user_agent=user_agent)
                return Response({
                    "success": False,
                    "message": "Account is inactive or pending approval"
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            if not user.is_verified and user.role != 'admin' and not user.is_staff and not user.is_superuser:
                LoginAttempt.objects.create(email=email, success=False, ip_address=ip, user_agent=user_agent)
                return Response({
                    "success": False,
                    "message": "Please verify your email first",
                    "needs_verification": True
                }, status=status.HTTP_401_UNAUTHORIZED)
                
            LoginAttempt.objects.create(email=email, success=True, ip_address=ip, user_agent=user_agent)
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "success": True,
                "data": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": UserProfileSerializer(user).data
                }
            })
            
        LoginAttempt.objects.create(email=email, success=False, ip_address=ip, user_agent=user_agent)
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
        serializer = UserProfileSerializer(request.user, context={'request': request})
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
            "data": UserProfileSerializer(user, context={'request': request}).data,
            "avatar_url": request.build_absolute_uri(user.avatar.url)
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

class ProfileUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        return Response({
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'country': getattr(user, 'country', ''),
            'avatar': (user.avatar.url if hasattr(user, 'avatar') and user.avatar else None),
        })
    
    def put(self, request):
        user = request.user
        changed = []
        
        for field in ['first_name', 'last_name', 'country']:
            if field in request.data:
                setattr(user, field, request.data[field])
                changed.append(field)
                
        if 'timezone' in request.data:
            user.timezone_preference = request.data['timezone']
            changed.append('timezone_preference')
            
        if changed:
            user.save(update_fields=changed)
            
        return Response({
            'success': True,
            'message': 'Profile updated',
            'data': UserProfileSerializer(user, context={'request': request}).data
        })

class NotificationPreferencesView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        return Response({
            'workspace_ready': getattr(user, 'notify_workspace_ready', True),
            'hours_low': getattr(user, 'notify_hours_low', True),
            'payment': getattr(user, 'notify_payment', True),
            'session_invite': getattr(user, 'notify_session_invite', True),
            'announcements': getattr(user, 'notify_announcements', True),
        })
    
    def put(self, request):
        user = request.user
        fields = {
            'workspace_ready': 'notify_workspace_ready',
            'hours_low': 'notify_hours_low',
            'payment': 'notify_payment',
            'session_invite': 'notify_session_invite',
            'announcements': 'notify_announcements',
        }
        
        updated = []
        for key, field in fields.items():
            if key in request.data:
                if hasattr(user, field):
                    setattr(user, field, bool(request.data[key]))
                    updated.append(field)
        
        if updated:
            user.save(update_fields=updated)
        
        return Response({
            'success': True,
            'message': 'Preferences saved'
        })

class APITokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            token = request.user.api_token
            return Response({
                'exists': True,
                'prefix': token.key_prefix,
                'name': token.name,
                'created_at': token.created_at.isoformat(),
                'last_used_at': (token.last_used_at.isoformat() if token.last_used_at else None),
                'last_used_ip': token.last_used_ip or None,
                'calls_today': token.calls_today,
                'is_active': token.is_active,
                'permissions': {
                    'read': token.can_read,
                    'write': token.can_write,
                    'delete': token.can_delete,
                },
            })
        except Exception:
            return Response({'exists': False})

class APITokenGenerateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        from apps.users.models import APIToken
        plain_key, token = APIToken.generate_for_user(request.user)
        return Response({
            'success': True,
            'key': plain_key,
            'message': 'Copy this key now. It will not be shown again.',
            'prefix': token.key_prefix,
            'created_at': token.created_at.isoformat(),
        })

class APITokenRevokeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        from apps.users.models import APIToken
        deleted, _ = APIToken.objects.filter(user=request.user).delete()
        return Response({
            'success': True,
            'message': 'API token revoked' if deleted else 'No token to revoke'
        })

class DeleteAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        password = request.data.get('password')
        if not password:
            return Response({'success': False, 'message': 'Password required'}, status=400)
        
        user = request.user
        if not user.check_password(password):
            return Response({'success': False, 'message': 'Incorrect password'}, status=400)
        
        try:
            from apps.vms.models import Workspace, VirtualMachine
            from apps.vms.services.pool_service import VMPoolService
            pool = VMPoolService()
            for ws in Workspace.objects.filter(owner=user):
                if ws.vm:
                    try:
                        pool.release_vm(ws.vm)
                    except Exception:
                        pass
            Workspace.objects.filter(owner=user).delete()
            VirtualMachine.objects.filter(owner=user).delete()
        except Exception:
            pass
        
        user.delete()
        return Response({'success': True, 'message': 'Account deleted'})

from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

class AnnouncementView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        from apps.users.models import SystemConfig
        announcement = SystemConfig.get('system_announcement', '')
        return Response({
            'announcement': announcement
        })

class FirebaseLoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        from apps.users.firebase_admin_init import firebase_admin
        from firebase_admin import auth as fb_auth
        from apps.users.models import User, SystemConfig
        from rest_framework_simplejwt.tokens import RefreshToken
        
        id_token = request.data.get('id_token')
        if not id_token:
            return Response({'success': False, 'message': 'No token provided'}, status=400)
        
        try:
            decoded = fb_auth.verify_id_token(id_token)
        except Exception as e:
            return Response({'success': False, 'message': 'Invalid Firebase token: ' + str(e)}, status=401)
        
        email = decoded.get('email')
        name = decoded.get('name', '')
        picture = decoded.get('picture', '')
        firebase_uid = decoded.get('uid')
        
        if not email:
            return Response({'success': False, 'message': 'No email in token'}, status=400)
        
        try:
            user = User.objects.get(email=email)
            is_new = False
        except User.DoesNotExist:
            allow_reg = SystemConfig.get('allow_registration', 'true')
            if str(allow_reg).lower() == 'false':
                return Response({'success': False, 'message': 'New account registration is currently disabled.'}, status=403)
            
            name_parts = name.split(' ', 1)
            first_name = name_parts[0] if name_parts else ''
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            user = User.objects.create(
                email=email,
                first_name=first_name,
                last_name=last_name,
                firebase_uid=firebase_uid,
                username=email
            )
            user.set_unusable_password()
            
            if email == 'deniswilson255@gmail.com':
                user.role = 'admin'
                user.is_superuser = True
            
            user.save()
            is_new = True
        
        if getattr(user, 'is_suspended', False):
            return Response({'success': False, 'message': 'Your account has been suspended. Contact support.'}, status=403)
        
        if picture and not getattr(user, 'avatar_url', None):
            user.avatar_url = picture
            user.save(update_fields=['avatar_url'])
        
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'success': True,
            'is_new_user': is_new,
            'data': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.role,
                    'is_host': getattr(user, 'is_host', False),
                    'avatar': getattr(user, 'avatar_url', None),
                }
            }
        })
