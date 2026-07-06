def send_notification(user, title, message, notification_type='system', link=''):
    from apps.notifications.models import Notification
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link
    )

def notify(user, title, message, notification_type='system', link=''):
    return send_notification(user, title, message, notification_type, link)
