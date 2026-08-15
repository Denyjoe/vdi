"""Workspace monetization access decision — per-template, no free tier.

Session hosting is pure pay-per-hour with no subscription requirement
(see apps/sessions/views.py PayAndStartSessionView) and is untouched by
this module. Workspaces are the second, separate revenue stream: every
template has its own hourly and monthly price. A user either has an
active TemplateSubscription for that specific template (unlimited,
calendar-based, 30 days) or a WorkspaceHoursBalance for that specific
template (usage-metered, deducted at stop time). Neither carries over
to a different template — access is decided per (user, template) pair.
"""
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone


def get_workspace_access(user, template):
    """
    Returns dict: {
        'can_launch': bool,
        'reason': str,  # 'subscription' | 'hours_balance' | 'payment_required'
        'hours_remaining': Decimal,
        'price_per_hour': Decimal,
        'price_per_month': Decimal,
    }
    """
    from apps.vms.models import TemplateSubscription, WorkspaceHoursBalance

    # 1. Active subscription for THIS template? Bypasses the balance check
    # entirely — unlimited launches regardless of hours_remaining.
    try:
        sub = TemplateSubscription.objects.get(user=user, template=template)
        if sub.is_active and sub.expires_at > timezone.now():
            return {
                'can_launch': True,
                'reason': 'subscription',
                'hours_remaining': _balance_for(user, template),
                'price_per_hour': template.price_per_hour,
                'price_per_month': template.price_per_month,
            }
    except ObjectDoesNotExist:
        pass

    # 2. Hours balance for THIS template?
    hours_remaining = _balance_for(user, template)
    if hours_remaining > 0:
        return {
            'can_launch': True,
            'reason': 'hours_balance',
            'hours_remaining': hours_remaining,
            'price_per_hour': template.price_per_hour,
            'price_per_month': template.price_per_month,
        }

    # 3. Neither — payment required, with real per-template prices.
    return {
        'can_launch': False,
        'reason': 'payment_required',
        'hours_remaining': hours_remaining,
        'price_per_hour': template.price_per_hour,
        'price_per_month': template.price_per_month,
    }


def _balance_for(user, template):
    from apps.vms.models import WorkspaceHoursBalance
    try:
        return WorkspaceHoursBalance.objects.get(user=user, template=template).hours_remaining
    except ObjectDoesNotExist:
        from decimal import Decimal
        return Decimal('0')
