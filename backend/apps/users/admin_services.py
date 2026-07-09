def log_admin_action(admin, action_type, description, target_type='', target_id=''):
    from apps.users.models import AdminActionLog
    return AdminActionLog.objects.create(
        admin=admin,
        action_type=action_type,
        description=description,
        target_type=target_type,
        target_id=str(target_id)
    )
