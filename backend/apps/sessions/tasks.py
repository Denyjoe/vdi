from celery import shared_task

@shared_task
def end_expired_sessions():
    from django.utils import timezone
    from apps.sessions.models import LiveSession
    
    expired = LiveSession.objects.filter(
        status='active',
        scheduled_end_at__lte=timezone.now()
    )
    
    for session in expired:
        try:
            from apps.sessions.services.session_lifecycle_service import SessionLifecycleService
            SessionLifecycleService.end_live_session(session)
            session.status = 'ended'
            session.auto_ended = True
            session.save()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Failed to auto-end session {session.id}: {str(e)}')
