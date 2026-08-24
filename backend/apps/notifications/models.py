from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('workspace_ready', 'Workspace Ready'),
        ('workspace_stopped', 'Workspace Stopped'),
        ('hours_balance_low', 'Hours Balance Running Low'),
        ('session_invite', 'Session Invite'),
        ('payment_confirmed', 'Payment Confirmed'),
        ('workspace_idle', 'Workspace Idle Warning'),
        ('direct_message', 'Direct Message'),
        ('system', 'System'),
        ('template_request_approved', 'Template Request Approved'),
        ('template_request_rejected', 'Template Request Rejected'),
        ('template_request_completed', 'Template Request Completed'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES, default='system')
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.title}"
