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
                'message': 'New account registration is currently disabled. Please contact support@ospace.io'
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
                        'at support@ospace.io')
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
        from apps.users.models import SystemConfig
        from apps.vms.models import VMTemplate
        from apps.vms.serializers import VMTemplateSerializer

        templates = VMTemplate.objects.filter(is_available=True)
        return Response({
            "success": True,
            "data": {
                "session_hosting_rate_tzs": float(SystemConfig.get('session_hosting_rate_tzs', '5000')),
                # Workspace pricing is now genuinely per-template — see each
                # entry's price_per_hour / price_per_month below. No more
                # platform-wide workspace price or free tier.
                "templates": VMTemplateSerializer(templates, many=True).data,
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
    """Legacy, unreachable from the shipped frontend (which is Google/
    GitHub-only via Firebase and never renders a password form) — kept
    only in case anything still calls it directly. Fixed for correctness
    regardless: previously read 'old_password' while every real caller of
    a form like this would naturally send 'current_password', so this
    endpoint could never actually succeed."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('current_password') or request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not user.check_password(old_password):
            return Response({"success": False, "message": "Incorrect old password"}, status=400)

        user.set_password(new_password)
        user.save()
        return Response({"success": True})


def _describe_user_agent(ua):
    """Best-effort, dependency-free device/browser label from a raw
    User-Agent string. Deliberately conservative — returns 'Unknown
    device' rather than guessing when nothing recognizable matches,
    instead of inventing a plausible-looking but fake label."""
    if not ua:
        return 'Unknown device'

    ua_lower = ua.lower()

    # iPhone/iPad UAs contain the literal substring "like Mac OS X" (for
    # legacy compatibility with sniffers), so iOS/Android must be checked
    # BEFORE the desktop-macOS check or every iPhone gets misreported as
    # a Mac — checked this by hand against a real iPhone Safari UA string.
    if 'iphone' in ua_lower or 'ipad' in ua_lower:
        os_label = 'iOS'
    elif 'android' in ua_lower:
        os_label = 'Android'
    elif 'windows' in ua_lower:
        os_label = 'Windows'
    elif 'mac os' in ua_lower or 'macintosh' in ua_lower:
        os_label = 'macOS'
    elif 'linux' in ua_lower:
        os_label = 'Linux'
    else:
        os_label = None

    if 'edg/' in ua_lower:
        browser_label = 'Edge'
    elif 'chrome/' in ua_lower and 'chromium' not in ua_lower:
        browser_label = 'Chrome'
    elif 'firefox/' in ua_lower:
        browser_label = 'Firefox'
    elif 'safari/' in ua_lower and 'chrome/' not in ua_lower:
        browser_label = 'Safari'
    else:
        browser_label = None

    if os_label and browser_label:
        return f'{browser_label} on {os_label}'
    if browser_label:
        return browser_label
    if os_label:
        return os_label
    return 'Unknown device'


class SessionListView(APIView):
    """Real active sessions for the current user, backed by SimpleJWT's
    own OutstandingToken/BlacklistedToken tables (the actual source of
    truth for which refresh tokens are still valid) — not a separate,
    parallel notion of 'session' that could drift from what the tokens
    actually allow."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        from apps.users.models import UserSession

        blacklisted_ids = set(
            BlacklistedToken.objects.filter(token__user=request.user)
            .values_list('token_id', flat=True)
        )
        outstanding = (
            OutstandingToken.objects.filter(user=request.user)
            .exclude(id__in=blacklisted_ids)
            .order_by('-created_at')
        )

        # Current request's own access-token jti, to mark "This device" —
        # correlated via UserSession since OutstandingToken only stores
        # the REFRESH token's jti, not the access token's.
        current_access_jti = None
        if getattr(request, 'auth', None) is not None:
            current_access_jti = request.auth.get('jti')

        sessions_by_jti = {
            s.refresh_jti: s
            for s in UserSession.objects.filter(user=request.user, refresh_jti__in=[str(t.jti) for t in outstanding])
        }

        data = []
        for token in outstanding:
            meta = sessions_by_jti.get(str(token.jti))
            data.append({
                'id': token.id,
                'device': _describe_user_agent(meta.user_agent) if meta else 'Unknown device',
                'ip_address': meta.ip_address if meta else '',
                'created_at': token.created_at,
                'expires_at': token.expires_at,
                'is_current': bool(meta and current_access_jti and meta.access_jti == current_access_jti),
            })

        return Response({'success': True, 'data': data})


class SessionRevokeView(APIView):
    """Blacklists one specific refresh token, ending that session. Any
    access token already issued for it remains valid until its own
    (short) expiry lapses — standard JWT-blacklist behavior, not a
    shortcut: the access/refresh split exists precisely so revocation
    doesn't require a database check on every single request."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

        token = get_object_or_404(OutstandingToken, id=pk, user=request.user)
        BlacklistedToken.objects.get_or_create(token=token)
        return Response({'success': True, 'message': 'Session revoked'})


class SessionRevokeAllView(APIView):
    """Blacklists every one of the user's outstanding refresh tokens
    except the one behind the current request, identified the same way
    SessionListView marks 'This device'."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        from apps.users.models import UserSession

        current_access_jti = None
        if getattr(request, 'auth', None) is not None:
            current_access_jti = request.auth.get('jti')

        current_refresh_jti = None
        if current_access_jti:
            current_session = UserSession.objects.filter(
                user=request.user, access_jti=current_access_jti
            ).first()
            if current_session:
                current_refresh_jti = current_session.refresh_jti

        outstanding = OutstandingToken.objects.filter(user=request.user)
        revoked = 0
        for token in outstanding:
            if current_refresh_jti and str(token.jti) == current_refresh_jti:
                continue
            _, created = BlacklistedToken.objects.get_or_create(token=token)
            if created:
                revoked += 1

        return Response({'success': True, 'message': f'{revoked} session(s) revoked'})

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
                'hours_used_this_month': round(float(ComputeUsageLog.objects.filter(user=user).aggregate(total=models.Sum('hours_used'))['total'] or 0), 1),
                'hours_remaining': 0,
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

                from apps.users.models import ActivityLog

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
                'message': 'Welcome to Ospace!'
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
            'workspace_idle': getattr(user, 'notify_workspace_idle', True),
            'direct_message': getattr(user, 'notify_direct_message', True),
        })

    def put(self, request):
        user = request.user
        fields = {
            'workspace_ready': 'notify_workspace_ready',
            'hours_low': 'notify_hours_low',
            'payment': 'notify_payment',
            'session_invite': 'notify_session_invite',
            'announcements': 'notify_announcements',
            'workspace_idle': 'notify_workspace_idle',
            'direct_message': 'notify_direct_message',
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

class PublicSettingsView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        from apps.users.models import SystemConfig
        return Response({
            'maintenance_mode': 
                str(SystemConfig.get('maintenance_mode', 'false')).lower() == 'true',
            'allow_registration': 
                str(SystemConfig.get('allow_registration', 'true')).lower() != 'false',
        })

class ProfileStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        from apps.vms.models import Workspace
        user = request.user
        
        workspace_count = Workspace.objects.filter(owner=user).exclude(status='deleted').count()
        active_count = Workspace.objects.filter(owner=user, status__in=['active', 'running']).count()
        
        sessions_joined = 0
        try:
            from apps.sessions.models import SessionParticipant
            sessions_joined = SessionParticipant.objects.filter(user=user).count()
        except Exception:
            pass
            
        hours_used = 0.0
        try:
            from apps.users.models import ComputeUsageLog
            from django.db.models import Sum
            h = ComputeUsageLog.objects.filter(user=user).aggregate(total=Sum('hours_used'))['total']
            hours_used = round(float(h or 0), 1)
        except Exception:
            pass
            
        return Response({
            'workspace_count': workspace_count,
            'active_workspaces': active_count,
            'sessions_joined': sessions_joined,
            'hours_used': hours_used,
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
        # Firebase's own claim for which real provider was used this sign-in
        # ('google.com', 'github.com', ...) — normalize to the short form
        # ('google', 'github') the frontend/UI use everywhere else.
        sign_in_provider = decoded.get('firebase', {}).get('sign_in_provider', '')
        auth_provider = sign_in_provider.replace('.com', '') if sign_in_provider else ''

        if not email:
            return Response({'success': False, 'message': 'No email in token'}, status=400)

        try:
            user = User.objects.get(email=email)
            is_new = False

            update_fields = []
            if not user.firebase_uid:
                user.firebase_uid = firebase_uid
                update_fields.append('firebase_uid')
            # Kept current on every login (not just "if unset") since a
            # user can genuinely switch which provider they sign in with
            # for the same email over time.
            if auth_provider and user.auth_provider != auth_provider:
                user.auth_provider = auth_provider
                update_fields.append('auth_provider')
            if update_fields:
                user.save(update_fields=update_fields)
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
                auth_provider=auth_provider,
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
        # IMPORTANT: RefreshToken.access_token is a property that mints a
        # BRAND NEW AccessToken (with its own random jti) on every access —
        # it is not cached. Reading it twice (once to store, once to
        # return) would store one token's jti and hand the client a
        # different one, permanently breaking "This device" matching.
        # Compute it exactly once and reuse that same instance everywhere.
        access = refresh.access_token

        # Real device/browser context for this specific login, correlated
        # by jti with the token pair just issued — this is what Active
        # Sessions in Security settings actually lists. Best-effort only:
        # a real login must never fail because this bookkeeping did.
        try:
            from apps.users.models import UserSession
            ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
            if ',' in ip:
                ip = ip.split(',')[0].strip()
            UserSession.objects.create(
                user=user,
                refresh_jti=str(refresh['jti']),
                access_jti=str(access['jti']),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
                ip_address=ip,
            )
        except Exception:
            pass

        return Response({
            'success': True,
            'is_new_user': is_new,
            'data': {
                'access': str(access),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.role,
                    'avatar': getattr(user, 'avatar_url', None),
                }
            }
        })

class SessionRateConfigView(APIView):
    def get(self, request):
        from apps.users.models import SystemConfig
        rate = SystemConfig.get('session_hosting_rate_tzs', '5000')
        return Response({'success': True, 'rate_tzs': float(rate)})
