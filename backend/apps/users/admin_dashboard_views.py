from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from apps.users.permissions import IsAdmin
from django.utils import timezone
from datetime import timedelta
from django.conf import settings

class AdminAttentionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        issues = []
        
        # Failed payments (last 7 days)
        try:
            from apps.users.models import Payment
            
            week_ago = timezone.now() - timedelta(days=7)
            failed_payments = Payment.objects.filter(status='failed', created_at__gte=week_ago).count()
            if failed_payments > 0:
                issues.append({
                    'type': 'failed_payments',
                    'severity': 'warning',
                    'count': failed_payments,
                    'label': 'Failed Payments',
                    'description': f'{failed_payments} payment(s) failed in the last 7 days',
                    'action_label': 'View Payments',
                    'action_link': '/admin/billing',
                })
        except Exception:
            pass
        
        # Stuck/errored VMs
        try:
            from apps.vms.models import VirtualMachine
            errored_vms = VirtualMachine.objects.filter(status='error').count()
            if errored_vms > 0:
                issues.append({
                    'type': 'errored_vms',
                    'severity': 'error',
                    'count': errored_vms,
                    'label': 'Errored VMs',
                    'description': f'{errored_vms} VM(s) in error state',
                    'action_label': 'View Workspaces',
                    'action_link': '/admin/vms',
                })
        except Exception:
            pass
        
        # Pool running low
        try:
            from apps.vms.models import VMPoolEntry
            available_pool = VMPoolEntry.objects.filter(status='available').count()
            if available_pool < 2:
                issues.append({
                    'type': 'low_pool',
                    'severity': 'warning',
                    'count': available_pool,
                    'label': 'Low VM Pool',
                    'description': f'Only {available_pool} pre-cloned VM(s) available',
                    'action_label': 'Pre-clone VMs',
                    'action_link': '/admin/vm-pool',
                })
        except Exception:
            pass
        
        # Proxmox/Guacamole down
        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            ps = ProxmoxService()
            ps.proxmox.nodes.get()
        except Exception:
            issues.append({
                'type': 'proxmox_down',
                'severity': 'error',
                'count': 1,
                'label': 'Proxmox Unreachable',
                'description': 'Cannot connect to Proxmox server',
                'action_label': 'View Status',
                'action_link': '/admin/dashboard',
            })
        
        return Response({
            'issues': issues,
            'total': len(issues),
        })


class ServiceRetryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request):
        service = request.data.get('service')
        
        result = {'success': False, 'message': ''}
        
        if service == 'proxmox':
            try:
                from apps.vms.services.proxmox_service import ProxmoxService
                ps = ProxmoxService()
                ps.proxmox.nodes.get()
                result = {'success': True, 'message': 'Proxmox connection restored'}
            except Exception as e:
                result = {'success': False, 'message': f'Still unreachable: {str(e)}'}
        
        elif service == 'guacamole':
            try:
                from apps.vms.services.guacamole_service import GuacamoleService
                gs = GuacamoleService()
                gs.authenticate()
                result = {'success': True, 'message': 'Guacamole connection restored'}
            except Exception as e:
                result = {'success': False, 'message': f'Still unreachable: {str(e)}'}
        
        return Response(result)


class AdminActivityView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from apps.users.models import AdminActionLog
        logs = AdminActionLog.objects.select_related('admin').all()[:20]
        
        return Response({
            'activities': [{
                'id': log.id,
                'admin_name': f'{log.admin.first_name} {log.admin.last_name}' if log.admin else 'System',
                'action_type': log.action_type,
                'description': log.description,
                'created_at': log.created_at.isoformat(),
            } for log in logs]
        })


class TriggerBackupView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request):
        import subprocess
        import os
        from datetime import datetime
        
        try:
            backup_dir = os.path.join(settings.BASE_DIR, 'backups')
            os.makedirs(backup_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'clouddesk_backup_{timestamp}.sql'
            filepath = os.path.join(backup_dir, filename)
            
            db_config = settings.DATABASES['default']
            
            cmd = [
                'pg_dump',
                '-h', db_config.get('HOST', 'localhost'),
                '-U', db_config['USER'],
                '-d', db_config['NAME'],
                '-f', filepath,
            ]
            
            env = os.environ.copy()
            if db_config.get('PASSWORD'):
                env['PGPASSWORD'] = db_config['PASSWORD']
            
            result = subprocess.run(cmd, env=env, capture_output=True, timeout=60)
            
            if result.returncode == 0:
                from apps.users.admin_services import log_admin_action
                log_admin_action(request.user, 'backup_triggered', f'Manual backup created: {filename}')
                
                return Response({
                    'success': True,
                    'filename': filename,
                    'size_mb': round(os.path.getsize(filepath) / (1024*1024), 2),
                })
            else:
                return Response({
                    'success': False,
                    'error': result.stderr.decode()
                }, status=500)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=500)
