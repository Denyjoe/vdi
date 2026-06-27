from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification

def send_notification(recipient, notification_type, title, message, data=None):
    """
    Create a notification in the database and push it via WebSocket.
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return None

    # Determine action_url from data if provided, otherwise default based on type
    action_url = None
    if data and 'action_url' in data:
        action_url = data['action_url']
    elif notification_type == 'New Material':
        action_url = '/student/materials'
    elif notification_type == 'New Assignment':
        action_url = '/student/assignments'
    elif notification_type == 'Practical Started' or notification_type == 'Practical Ended':
        action_url = '/student/practicals'

    # Create DB record
    notification = Notification.objects.create(
        user=recipient,
        type=notification_type,
        title=title,
        message=message,
        action_url=action_url
    )

    # 2. Push via WebSocket
    channel_layer = get_channel_layer()
    group_name = f"user_{recipient.id}_notifications"
    
    payload = {
        'id': notification.id,
        'title': notification.title,
        'message': notification.message,
        'type': notification.type,
        'is_read': notification.is_read,
        'action_url': notification.action_url,
        'created_at': notification.created_at.isoformat()
    }

    print(f"WS PUSH: Sending to {group_name}")
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'notification_message',
            'message': payload
        }
    )
    print(f"WS PUSH: Sent to {group_name}")
    
    return notification
