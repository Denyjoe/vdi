class MaintenanceModeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        from apps.users.models import SystemConfig
        from django.http import JsonResponse
        
        maintenance = str(SystemConfig.get('maintenance_mode', 'false')).lower()
        
        if maintenance == 'true':
            # Allow admin auth endpoints and admin users through
            is_admin_path = (
                request.path.startswith('/api/admin/') or
                request.path.startswith('/api/auth/login/') or
                request.path.startswith('/admin/') or
                request.path.startswith('/api/config/announcement/') # we will create this
            )
            
            is_admin_user = False
            if hasattr(request, 'user') and request.user.is_authenticated:
                is_admin_user = getattr(request.user, 'role', '') == 'admin'
            elif 'HTTP_AUTHORIZATION' in request.META:
                auth_header = request.META['HTTP_AUTHORIZATION']
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
                    try:
                        from rest_framework_simplejwt.tokens import AccessToken
                        from apps.users.models import User
                        access_token = AccessToken(token)
                        user_id = access_token['user_id']
                        user = User.objects.get(id=user_id)
                        is_admin_user = user.role == 'admin'
                    except Exception:
                        pass
            
            if not is_admin_path and not is_admin_user:
                return JsonResponse({
                    'success': False,
                    'maintenance': True,
                    'message': 'Ospace is currently under maintenance. Please check back shortly.'
                }, status=503)
        
        return self.get_response(request)
