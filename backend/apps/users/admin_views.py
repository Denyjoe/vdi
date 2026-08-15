from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from apps.users.permissions import IsAdmin
from apps.users.models import User
from apps.users.serializers import UserProfileSerializer

class AdminUserListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from apps.users.models import User
        from django.db.models import Q
        
        search = request.query_params.get('search', '')
        role_filter = request.query_params.get('role', 'all')
        status_filter = request.query_params.get('status', 'all')
        sort = request.query_params.get('sort', '-date_joined')
        
        users = User.objects.all()
        
        if search:
            users = users.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search))
        
        if role_filter == 'admin':
            users = users.filter(role='admin')
        elif role_filter == 'subscriber':
            users = users.filter(template_subscriptions__is_active=True).distinct()

        if status_filter == 'active':
            users = users.filter(is_suspended=False)
        elif status_filter == 'suspended':
            users = users.filter(is_suspended=True)

        users = users.order_by(sort)

        from django.utils import timezone
        results = []
        for u in users:
            avatar_url = None
            if hasattr(u, 'avatar') and u.avatar:
                avatar_url = request.build_absolute_uri(u.avatar.url)

            plan_name = 'Pay-as-you-go'
            has_sub = False
            sub_expires = None
            active_sub = u.template_subscriptions.filter(
                is_active=True, expires_at__gt=timezone.now()
            ).select_related('template').order_by('expires_at').first()
            if active_sub:
                plan_name = f'Unlimited: {active_sub.template.name}'
                has_sub = True
                sub_expires = active_sub.expires_at.isoformat()

            results.append({
                'id': u.id,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'email': u.email,
                'avatar': avatar_url,
                'plan': plan_name,
                'has_subscription': has_sub,
                'subscription_expires_at': sub_expires,
                'role': getattr(u, 'role', 'user'),
                'is_suspended': getattr(u, 'is_suspended', False),
                'date_joined': u.date_joined.isoformat() if hasattr(u, 'date_joined') and u.date_joined else None,
            })

        from apps.vms.models import TemplateSubscription
        return Response({
            'users': results,
            'total': len(results),
            'counts': {
                'all': User.objects.count(),
                'subscribers': TemplateSubscription.objects.filter(is_active=True, expires_at__gt=timezone.now()).values('user').distinct().count(),
                'admins': User.objects.filter(role='admin').count(),
                'active': User.objects.filter(is_suspended=False).count(),
                'suspended': User.objects.filter(is_suspended=True).count(),
            }
        })

class AdminUserStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    def get(self, request):
        from django.utils import timezone
        from apps.vms.models import TemplateSubscription
        total_users = User.objects.count()
        subscribers = TemplateSubscription.objects.filter(is_active=True, expires_at__gt=timezone.now()).values('user').distinct().count()
        admins = User.objects.filter(role='admin').count()
        active_users = User.objects.filter(is_active=True).count()

        return Response({
            "success": True,
            "data": {
                "total_users": total_users,
                "subscribers": subscribers,
                "admins": admins,
                "active_users": active_users
            }
        })

class AdminUserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request, pk):
        from apps.users.models import User, ComputeUsageLog, Payment
        from apps.vms.models import Workspace
        from django.db.models import Sum
        
        try:
            u = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        
        # Real compute usage hours from logs
        hours_used = 0.0
        try:
            h = ComputeUsageLog.objects.filter(user=u).aggregate(total=Sum('hours_used'))['total']
            hours_used = round(float(h or 0), 1)
        except Exception:
            pass
        
        # Real all-time payments total
        total_spent = 0.0
        try:
            spent = Payment.objects.filter(user=u, status='completed').aggregate(total=Sum('amount_tzs'))['total']
            total_spent = float(spent or 0)
        except Exception:
            pass
        
        # Workspaces
        workspaces = []
        try:
            for ws in Workspace.objects.filter(owner=u).select_related('vm_template')[:10]:
                workspaces.append({
                    'id': ws.id,
                    'name': ws.name,
                    'template': (ws.vm_template.name if ws.vm_template else 'Unknown'),
                    'status': ws.status,
                    'created_at': ws.created_at.isoformat() if hasattr(ws, 'created_at') and ws.created_at else None,
                })
        except Exception:
            pass
        
        # Sessions
        sessions_hosted = 0
        sessions_joined = 0
        try:
            from apps.sessions.models import LiveSession, SessionParticipant
            sessions_hosted = LiveSession.objects.filter(host=u).count()
            sessions_joined = SessionParticipant.objects.filter(user=u).count()
        except Exception:
            pass
        
        avatar_url = None
        if hasattr(u, 'avatar') and u.avatar:
            avatar_url = request.build_absolute_uri(u.avatar.url)

        from django.utils import timezone
        has_active_subscription = False
        sub_expires = None
        plan_name = 'Pay-as-you-go'
        active_sub = u.template_subscriptions.filter(
            is_active=True, expires_at__gt=timezone.now()
        ).select_related('template').order_by('expires_at').first()
        if active_sub:
            has_active_subscription = True
            sub_expires = active_sub.expires_at.isoformat()
            plan_name = f'Unlimited: {active_sub.template.name}'

        return Response({
            'id': u.id,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'email': u.email,
            'avatar': avatar_url,
            'country': getattr(u, 'country', ''),
            'plan': plan_name,
            'workspace_subscription_active': has_active_subscription,
            'subscription_expires_at': sub_expires,
            'role': getattr(u, 'role', 'user'),
            'is_suspended': getattr(u, 'is_suspended', False),
            'suspended_reason': getattr(u, 'suspended_reason', ''),
            'date_joined': u.date_joined.isoformat() if hasattr(u, 'date_joined') and u.date_joined else None,
            'usage': {
                'hours_used': hours_used,
                'total_spent': total_spent,
                'workspace_count': len(workspaces),
                'sessions_hosted': sessions_hosted,
                'sessions_joined': sessions_joined,
            },
            'workspaces': workspaces,
        })
    
    def patch(self, request, pk):
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"success": False, "message": "User not found"}, status=404)
            
        role = request.data.get('role')
        if role in ['admin', 'user']:
            user.role = role
            user.save()
            from apps.users.admin_services import log_admin_action
            log_admin_action(request.user, 'user_role_changed', f"Changed role of {user.username} to {role}", 'user', user.id)
            return Response({"success": True, "data": UserProfileSerializer(user).data})
            
        return Response({"success": False, "message": "Invalid role"}, status=400)

class SystemConfigView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from apps.users.models import SystemConfig
        configs = SystemConfig.objects.all()
        data = {c.key: c.value for c in configs}
        return Response({
            "success": True,
            "data": data
        })

    def put(self, request):
        from apps.users.models import SystemConfig

        # Read the announcement's PRIOR value before it gets overwritten
        # below, so we can tell whether this request is genuinely setting
        # a new one (vs. re-saving the same text, or some unrelated config
        # key) — only a real change should notify anyone.
        old_announcement = SystemConfig.get('system_announcement', '')

        for key, value in request.data.items():
            SystemConfig.set(key, value)

        configs = SystemConfig.objects.all()
        data = {c.key: c.value for c in configs}

        # The banner itself (AnnouncementView) is public and unconditional
        # by design — it's meant for things like maintenance windows that
        # everyone needs to see regardless of preference. But the
        # Notification-Preferences "System Announcements" toggle promises
        # users a real, dismissible/opt-outable record of the same event,
        # so a genuine change here also creates one, respecting each
        # user's notify_announcements preference exactly like any other
        # notification type.
        new_announcement = data.get('system_announcement', old_announcement)
        if 'system_announcement' in request.data and new_announcement and new_announcement != old_announcement:
            from apps.notifications.services import notify
            for user in User.objects.filter(is_active=True):
                try:
                    notify(
                        user=user,
                        title='System Announcement',
                        message=new_announcement,
                        notification_type='system',
                    )
                except Exception:
                    pass

        from apps.users.admin_services import log_admin_action
        log_admin_action(request.user, 'config_changed', "Updated system configuration")

        return Response({
            "success": True,
            "data": data,
            "message": "System configuration updated"
        })

class AdminSuspendUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request, pk):
        from apps.users.models import User
        from django.utils import timezone
        
        try:
            u = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        
        if u.role == 'admin':
            return Response({
                'success': False,
                'message': 'Cannot suspend an admin account'
            }, status=400)
        
        reason = request.data.get('reason', '')
        
        u.is_suspended = True
        u.suspended_at = timezone.now()
        u.suspended_reason = reason
        u.suspended_by = request.user
        u.save()
        
        # Force stop all active VMs
        stopped_count = 0
        try:
            from apps.vms.models import Workspace
            from apps.vms.services.pool_service import VMPoolService
            pool = VMPoolService()
            
            for ws in Workspace.objects.filter(owner=u, status__in=['active', 'running']):
                try:
                    if ws.vm:
                        pool.release_vm(ws.vm)
                    ws.status = 'stopped'
                    ws.save()
                    stopped_count += 1
                except Exception:
                    pass
        except Exception:
            pass
        
        # End any live sessions they host
        try:
            from apps.sessions.models import LiveSession
            LiveSession.objects.filter(host=u, status='active').update(status='ended')
        except Exception:
            pass
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'user_suspended',
            f'Suspended {u.first_name} {u.last_name} ({u.email})' + (f' — {reason}' if reason else ''),
            target_type='user',
            target_id=u.id)
        
        return Response({
            'success': True,
            'message': f'User suspended. {stopped_count} workspace(s) stopped.'
        })


class AdminReactivateUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request, pk):
        from apps.users.models import User
        
        try:
            u = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        
        u.is_suspended = False
        u.suspended_at = None
        u.suspended_reason = ''
        u.save()
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'user_reactivated',
            f'Reactivated {u.first_name} {u.last_name} ({u.email})',
            target_type='user',
            target_id=u.id)
        
        return Response({
            'success': True,
            'message': 'User reactivated'
        })

class AdminTriggerResetView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request, pk):
        from apps.users.models import User
        import random
        from django.utils import timezone
        from datetime import timedelta
        
        try:
            u = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        
        code = str(random.randint(100000, 999999))
        u.password_reset_code = code
        u.password_reset_expires = timezone.now() + timedelta(hours=24)
        u.save()
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'user_role_changed',  
            f'Triggered password reset for {u.email}')
        
        return Response({
            'success': True,
            'message': f'Password reset triggered for {u.email}. In dev mode, code is: {code}',
            'dev_code': code,
        })

class AdminBulkActionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request):
        from apps.users.models import User
        
        user_ids = request.data.get('user_ids', [])
        action = request.data.get('action')
        
        if not user_ids or not action:
            return Response({
                'success': False,
                'message': 'user_ids and action required'
            }, status=400)
        
        users = User.objects.filter(id__in=user_ids).exclude(role='admin')
        
        count = 0
        if action == 'suspend':
            for u in users:
                u.is_suspended = True
                u.save()
                count += 1
        elif action == 'reactivate':
            for u in users:
                u.is_suspended = False
                u.save()
                count += 1
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'user_role_changed',
            f'Bulk action "{action}" applied to {count} user(s)')
        
        return Response({
            'success': True,
            'message': f'{action} applied to {count} user(s)'
        })

class AdminExportUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        import csv
        from django.http import HttpResponse
        from apps.users.models import User
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="ospace_users.csv"'
        
        from django.utils import timezone

        writer = csv.writer(response)
        writer.writerow(['Name', 'Email', 'Role', 'Plan / Subscription', 'Status', 'Joined'])

        for u in User.objects.all():
            plan_name = 'Pay-as-you-go'
            active_sub = u.template_subscriptions.filter(
                is_active=True, expires_at__gt=timezone.now()
            ).select_related('template').order_by('expires_at').first()
            if active_sub:
                plan_name = f'Unlimited: {active_sub.template.name} (Expires: {active_sub.expires_at.strftime("%Y-%m-%d")})'
            writer.writerow([
                f'{u.first_name} {u.last_name}'.strip() or u.username,
                u.email,
                getattr(u, 'role', 'user'),
                plan_name,
                'Suspended' if getattr(u, 'is_suspended', False) else 'Active',
                u.date_joined.strftime('%Y-%m-%d') if hasattr(u, 'date_joined') and u.date_joined else '',
            ])
        
        return response


class BackupListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        import os
        from django.conf import settings
        
        backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        
        if not os.path.exists(backup_dir):
            return Response({'backups': []})
        
        files = []
        for f in os.listdir(backup_dir):
            if f.endswith('.sql'):
                path = os.path.join(backup_dir, f)
                files.append({
                    'filename': f,
                    'size_mb': round(os.path.getsize(path) / (1024*1024), 2),
                    'created_at': os.path.getctime(path),
                })
        
        files.sort(key=lambda x: x['created_at'], reverse=True)
        
        return Response({
            'backups': files
        })

class BackupDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request, filename):
        import os
        from django.http import FileResponse, Http404
        from django.conf import settings
        
        # Security: prevent path traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            raise Http404()
        
        backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        filepath = os.path.join(backup_dir, filename)
        
        if not os.path.exists(filepath):
            raise Http404()
        
        return FileResponse(open(filepath, 'rb'), as_attachment=True, filename=filename)


class SecurityLogView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from apps.users.models import LoginAttempt
        from django.utils import timezone
        from datetime import timedelta
        
        attempts = LoginAttempt.objects.all()[:50]
        
        failed_last_24h = LoginAttempt.objects.filter(
            success=False,
            created_at__gte=timezone.now() - timedelta(hours=24)
        ).count()
        
        return Response({
            'attempts': [{
                'email': a.email,
                'success': a.success,
                'ip_address': a.ip_address,
                'created_at': a.created_at.isoformat(),
            } for a in attempts],
            'failed_last_24h': failed_last_24h,
        })

class AuditLogView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from apps.users.models import AdminActionLog
        
        logs = AdminActionLog.objects.select_related('admin')
        
        search = request.query_params.get('search', '')
        if search:
            logs = logs.filter(description__icontains=search)
        
        action_type = request.query_params.get('action_type', '')
        if action_type:
            logs = logs.filter(action_type=action_type)
        
        try:
            page = int(request.query_params.get('page', 1))
        except ValueError:
            page = 1
            
        page_size = 20
        start = (page - 1) * page_size
        end = start + page_size
        
        total = logs.count()
        logs = logs.order_by('-created_at')[start:end]
        
        return Response({
            'logs': [{
                'id': l.id,
                'admin_name': f'{l.admin.first_name} {l.admin.last_name}' if l.admin else 'System',
                'action_type': l.action_type,
                'description': l.description,
                'created_at': l.created_at.isoformat(),
            } for l in logs],
            'total': total,
            'page': page,
            'total_pages': max(1, (total + page_size - 1) // page_size),
        })

class AdminLogsView(APIView):
    """Feeds AdminLogsPage.jsx (GET /api/admin/logs/) — was never wired to
    any URL at all, so this page has always shown nothing regardless of
    real activity. Reuses the same AdminActionLog data as AuditLogView,
    adapted to the {success, data: [...]} shape the page expects."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from apps.users.models import AdminActionLog

        logs = AdminActionLog.objects.select_related('admin').order_by('-created_at')[:200]

        return Response({
            'success': True,
            'data': [{
                'id': l.id,
                'timestamp': l.created_at.isoformat(),
                'user': f'{l.admin.first_name} {l.admin.last_name}'.strip() if l.admin else 'System',
                'user_email': l.admin.email if l.admin else '',
                'action': l.get_action_type_display() if hasattr(l, 'get_action_type_display') else l.action_type,
                'description': l.description,
                # Admin actions aren't tracked with an IP address (unlike
                # LoginAttempt, which is), so this is honestly empty
                # rather than fabricated.
                'ip_address': '',
            } for l in logs],
        })


class AdminAPITokensView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from apps.users.models import APIToken
        
        tokens = APIToken.objects.select_related('user').filter(is_active=True).order_by('-created_at')
        
        return Response({
            'tokens': [{
                'id': t.id,
                'user_email': t.user.email,
                'user_name': f'{t.user.first_name} {t.user.last_name}',
                'prefix': t.key_prefix,
                'created_at': t.created_at.isoformat(),
                'last_used_at': t.last_used_at.isoformat() if t.last_used_at else None,
                'calls_today': t.calls_today,
            } for t in tokens]
        })

class AdminRevokeTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request, token_id):
        from apps.users.models import APIToken
        
        try:
            token = APIToken.objects.get(id=token_id)
            user_email = token.user.email
            token.delete()
            
            from apps.users.admin_services import log_admin_action
            log_admin_action(request.user, 'config_changed', f'Revoked API token for {user_email}')
            
            return Response({
                'success': True,
                'message': 'Token revoked'
            })
        except APIToken.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
