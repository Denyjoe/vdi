class MaintenanceModeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        from apps.users.models import SystemConfig
        from django.http import JsonResponse
        
        maintenance = SystemConfig.get('maintenance_mode', 'false')
        
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
            
            if not is_admin_path and not is_admin_user:
                return JsonResponse({
                    'success': False,
                    'maintenance': True,
                    'message': 'CloudDesk is currently under maintenance. Please check back shortly.'
                }, status=503)
        
        return self.get_response(request)
