"""
Real-tested finding (security audit): 30 rapid unauthenticated requests to
/api/auth/firebase-login/ all processed with zero rate limiting (no 429 at
any point, 1.37s for 30 requests). The only throttle configured anywhere
in this app was scoped to the public API's own token auth
(apps.api.v1_views.ApiTokenRateThrottle) - login and other genuinely
sensitive, unauthenticated-or-high-risk endpoints had no rate limiting at
all, leaving them open to credential-stuffing-style hammering and basic
resource-exhaustion.

Two small, real throttle classes, following the same pattern already
established by ApiTokenRateThrottle:
- LoginRateThrottle: keyed by IP (DRF's built-in AnonRateThrottle), for
  unauthenticated login/auth endpoints.
- SensitiveActionRateThrottle: keyed by the authenticated user (DRF's
  built-in UserRateThrottle), for authenticated-but-high-risk actions
  (account deletion, payments) where an attacker holding a valid token
  could otherwise hammer the endpoint without limit.

Rates are defined in REST_FRAMEWORK.DEFAULT_THROTTLE_RATES in settings.py.
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


class SensitiveActionRateThrottle(UserRateThrottle):
    scope = 'sensitive_action'
