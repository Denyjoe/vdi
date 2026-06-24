import secrets
from django.utils import timezone
from apps.sessions.models import RemoteSession, ActivityLog

class RemoteSessionManager:
    
    def connect(self, vm, user, ip_address):
        if vm.status != 'running':
            raise ValueError("VM must be running to connect")
            
        existing = RemoteSession.objects.filter(vm=vm, user=user, status='active').first()
        if existing:
            return existing
            
        session = RemoteSession.objects.create(
            vm=vm,
            user=user,
            status='active',
            ip_address=ip_address
        )
        
        ActivityLog.objects.create(
            user=user,
            action='SESSION_CONNECTED',
            description=f"{user.email} connected to {vm.name}",
            ip_address=ip_address
        )
        
        return session
        
    def disconnect(self, session):
        session.status = 'disconnected'
        session.ended_at = timezone.now()
        session.duration_seconds = int((session.ended_at - session.started_at).total_seconds())
        session.save()
        
        ActivityLog.objects.create(
            user=session.user,
            action='SESSION_DISCONNECTED',
            description=f"{session.user.email} disconnected from {session.vm.name} (Duration: {session.duration_seconds}s)",
            ip_address=session.ip_address
        )
        
        return session
        
    def terminate(self, session, terminated_by):
        session.status = 'terminated'
        session.ended_at = timezone.now()
        session.duration_seconds = int((session.ended_at - session.started_at).total_seconds())
        session.save()
        
        ActivityLog.objects.create(
            user=session.user,
            action='SESSION_TERMINATED',
            description=f"Session terminated by {terminated_by.email}",
            ip_address=session.ip_address
        )
        
        return session
        
    def get_active_sessions(self, class_room=None):
        qs = RemoteSession.objects.filter(status='active')
        if class_room:
            qs = qs.filter(vm__owner__enrollments__class_room=class_room)
        return qs
        
    def generate_session_token(self, session):
        token = secrets.token_urlsafe(32)
        session.metadata['session_token'] = token
        session.save(update_fields=['metadata'])
        return token

session_manager = RemoteSessionManager()
