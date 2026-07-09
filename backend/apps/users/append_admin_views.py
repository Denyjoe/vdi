with open('admin_views.py', 'r', encoding='utf-8') as f:
    code = f.read()

# We need to completely replace AdminUserListView and AdminUserDetailView, and append others.
# First let's just rewrite the whole file since we can easily recreate the other views.

new_content = '''from rest_framework.views import APIView
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
        
        if role_filter == 'host':
            users = users.filter(is_host=True)
        elif role_filter == 'admin':
            users = users.filter(role='admin')
        elif role_filter == 'free':
            users = users.exclude(role='admin').filter(is_host=False)
        
        if status_filter == 'active':
            users = users.filter(is_suspended=False)
        elif status_filter == 'suspended':
            users = users.filter(is_suspended=True)
        
        users = users.order_by(sort)
        
        results = []
        for u in users:
            avatar_url = None
            if hasattr(u, 'avatar') and u.avatar:
                avatar_url = request.build_absolute_uri(u.avatar.url)
            
            plan_name = 'Free'
            try:
                if u.subscription and u.subscription.plan:
                    plan_name = getattr(u.subscription.plan, 'display_name', getattr(u.subscription.plan, 'name', 'Free'))
            except Exception:
                pass
            
            results.append({
                'id': u.id,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'email': u.email,
                'avatar': avatar_url,
                'plan': plan_name,
                'is_host': getattr(u, 'is_host', False),
                'role': getattr(u, 'role', 'user'),
                'is_suspended': getattr(u, 'is_suspended', False),
                'date_joined': u.date_joined.isoformat() if hasattr(u, 'date_joined') and u.date_joined else None,
            })
        
        return Response({
            'users': results,
            'total': len(results),
            'counts': {
                'all': User.objects.count(),
                'free': User.objects.filter(is_host=False).exclude(role='admin').count(),
                'hosts': User.objects.filter(is_host=True).count(),
                'admins': User.objects.filter(role='admin').count(),
                'active': User.objects.filter(is_suspended=False).count(),
                'suspended': User.objects.filter(is_suspended=True).count(),
            }
        })

class AdminUserStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    def get(self, request):
        total_users = User.objects.count()
        hosts = User.objects.filter(is_host=True).count()
        admins = User.objects.filter(role='admin').count()
        active_users = User.objects.filter(is_active=True).count()
        
        return Response({
            "success": True,
            "data": {
                "total_users": total_users,
                "hosts": hosts,
                "admins": admins,
                "active_users": active_users
            }
        })

class AdminUserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request, pk):
        from apps.users.models import User
        from apps.vms.models import Workspace
        
        try:
            u = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        
        # Usage stats
        hours_used = 0
        total_spent = 0
        try:
            sub = getattr(u, 'subscription', None)
            if sub:
                hours_used = float(getattr(sub, 'compute_hours_used', 0) or 0)
        except Exception:
            pass
        
        try:
            from apps.users.models import Payment
            from django.db.models import Sum
            spent = Payment.objects.filter(user=u, status='completed').aggregate(total=Sum('amount'))['total']
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
            from apps.sessions.models import LiveSession
            sessions_hosted = LiveSession.objects.filter(host=u).count()
        except Exception:
            pass
        
        avatar_url = None
        if hasattr(u, 'avatar') and u.avatar:
            avatar_url = request.build_absolute_uri(u.avatar.url)
        
        return Response({
            'id': u.id,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'email': u.email,
            'avatar': avatar_url,
            'country': getattr(u, 'country', ''),
            'is_host': getattr(u, 'is_host', False),
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
        for key, value in request.data.items():
            SystemConfig.set(key, value)
            
        configs = SystemConfig.objects.all()
        data = {c.key: c.value for c in configs}
        
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
        elif action == 'make_host':
            for u in users:
                u.is_host = True
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
        response['Content-Disposition'] = 'attachment; filename="clouddesk_users.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Name', 'Email', 'Role', 'Is Host', 'Status', 'Joined'])
        
        for u in User.objects.all():
            writer.writerow([
                f'{u.first_name} {u.last_name}',
                u.email,
                getattr(u, 'role', 'user'),
                'Yes' if getattr(u, 'is_host', False) else 'No',
                'Suspended' if getattr(u, 'is_suspended', False) else 'Active',
                u.date_joined.strftime('%Y-%m-%d') if hasattr(u, 'date_joined') and u.date_joined else '',
            ])
        
        return response
'''

with open('admin_views.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Appended views")
