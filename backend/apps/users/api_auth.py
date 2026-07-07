from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

class APIKeyAuthentication(BaseAuthentication):
    """Authenticate via X-API-Key header.
    Falls through to other auth methods 
    if no API key provided."""
    
    def authenticate(self, request):
        api_key = request.headers.get('X-API-Key')
        
        if not api_key:
            return None  # Let other auth handle it
        
        from apps.users.models import APIToken
        user = APIToken.authenticate(api_key)
        
        if user is None:
            raise AuthenticationFailed('Invalid or rate-limited API key')
        
        # Record IP
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ',' in ip:
            ip = ip.split(',')[0].strip()
        
        try:
            token = user.api_token
            token.last_used_ip = ip
            token.save(update_fields=['last_used_ip'])
        except Exception:
            pass
        
        return (user, None)
