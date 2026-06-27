from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification

def send_notification(user, title, message, type='info', action_url=None):
    """
    Creates a Notification record in the database and pushes it to the user 
    via WebSocket.
    """
    # 1. Save to DB
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        type=type,
        action_url=action_url
    )

    # 2. Push via WebSocket
    channel_layer = get_channel_layer()
    group_name = f"user_{user.id}_notifications"
    
    payload = {
        'id': notification.id,
        'title': notification.title,
        'message': notification.message,
        'type': notification.type,
        'is_read': notification.is_read,
        'action_url': notification.action_url,
        'created_at': notification.created_at.isoformat()
    }

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'notification_message',
            'message': payload
        }
    )
    
    return notification
