from django.urls import path
from . import subscription_views

urlpatterns = [
    path('plans/', subscription_views.SubscriptionPlansView.as_view(), name='subscription-plans'),
    path('plans/<int:plan_id>/', subscription_views.SubscriptionPlanUpdateView.as_view(), name='update-plan'),
    path('my-plan/', subscription_views.UserSubscriptionView.as_view(), name='my-plan'),
    path('upgrade/', subscription_views.UpgradeSubscriptionView.as_view(), name='upgrade-plan'),
]
