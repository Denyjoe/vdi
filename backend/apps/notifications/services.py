def send_notification(user, title, message, notification_type='system', link=''):
    # Alias for backwards compatibility if needed, but we'll check preferences here
    return notify(user, title, message, notification_type, link)

def notify(user, title, message, notification_type='system', link=''):
    """Create a notification, respecting user preferences."""
    
    # Check user preferences
    pref_map = {
        'workspace_ready': 'notify_workspace_ready',
        'workspace_stopped': 'notify_workspace_ready',
        'hours_balance_low': 'notify_hours_low',
        'payment_confirmed': 'notify_payment',
        'session_invite': 'notify_session_invite',
        'workspace_idle': 'notify_workspace_idle',
        'direct_message': 'notify_direct_message',
        'system': 'notify_announcements',
    }
    
    pref_field = pref_map.get(notification_type)
    if pref_field and hasattr(user, pref_field):
        if not getattr(user, pref_field, True):
            return None  # User opted out
            
    from apps.notifications.models import Notification
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link
    )
