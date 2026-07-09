with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/admin_views.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_views = '''

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
'''

if 'class SecurityLogView' not in content:
    with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/admin_views.py', 'a', encoding='utf-8') as f:
        f.write(new_views)
    print("Added new views to admin_views.py")

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/admin_urls.py', 'r', encoding='utf-8') as f:
    urls_content = f.read()

if 'security-log/' not in urls_content:
    import_addition = 'from .admin_views import (\\n    SecurityLogView, AuditLogView, AdminAPITokensView, AdminRevokeTokenView,'
    urls_content = urls_content.replace('from .admin_views import (', import_addition)
    
    url_addition = '''    path('security-log/', SecurityLogView.as_view(), name='admin-security-log'),
    path('audit-log/', AuditLogView.as_view(), name='admin-audit-log'),
    path('api-tokens/', AdminAPITokensView.as_view(), name='admin-api-tokens'),
    path('api-tokens/<int:token_id>/revoke/', AdminRevokeTokenView.as_view(), name='admin-revoke-token'),'''
    urls_content = urls_content.replace("path('backup/list/',", url_addition + "\\n    path('backup/list/',")
    
    with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/admin_urls.py', 'w', encoding='utf-8') as f:
        f.write(urls_content)
    print("Added new URLs to admin_urls.py")
