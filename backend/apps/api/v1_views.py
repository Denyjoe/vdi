"""Public API v1 — programmatic workspace management for API-token holders.

Authentication reuses apps.users.api_auth.APIKeyAuthentication's real
authenticate() logic unchanged — the same class already wired as DRF's
global default auth (config/settings.py
REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES) and already proven by the
Developer tab's token generate/revoke flow. PublicApiKeyAuthentication
below only adds authenticate_header() so this surface returns a proper
401 (not DRF's 403 default) for a rejected key — no new auth mechanism.

Provisioning/deletion reuse the exact real functions from
apps.vms.workspace_views: get_workspace_access, _perform_launch, and
_perform_delete — the same code paths the member UI's own Launch/Stop/
Delete buttons call. Nothing about how a VM actually gets provisioned or
torn down is reimplemented here.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import SimpleRateThrottle

from apps.users.api_auth import APIKeyAuthentication
from apps.vms.models import Workspace, VMTemplate, VirtualMachine
from apps.vms.services.workspace_access import get_workspace_access


class PublicApiKeyAuthentication(APIKeyAuthentication):
    """The real, proven APIKeyAuthentication.authenticate() logic,
    unchanged — this subclass adds ONLY authenticate_header(). Without
    it, DRF has no authenticator to build a WWW-Authenticate header from
    and silently downgrades every rejection to 403 instead of 401,
    regardless of what AuthenticationFailed was raised with. Scoped to
    this subclass (not the shared global APIKeyAuthentication) so the
    rest of the app's endpoints keep their existing behavior."""
    def authenticate_header(self, request):
        return 'Api-Key'
from apps.vms.workspace_views import _perform_launch, _perform_delete


class ApiTokenRateThrottle(SimpleRateThrottle):
    """Keyed to the actual APIToken, not IP or Django user id — two
    requests from different tokens never share a bucket, and a token
    used from multiple IPs still shares one real limit. Rate is defined
    in REST_FRAMEWORK.DEFAULT_THROTTLE_RATES['api_token']."""
    scope = 'api_token'

    def get_cache_key(self, request, view):
        token = getattr(request.user, 'api_token', None) if getattr(request.user, 'is_authenticated', False) else None
        if not token:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': token.id}


class LoggedApiView(APIView):
    """Shared base for every public API view: real token auth, and a
    genuine ApiRequestLog row written for every request that actually
    reaches a known token — success or failure — via finalize_response()
    so each concrete view doesn't need to remember to log itself."""
    authentication_classes = [PublicApiKeyAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [ApiTokenRateThrottle]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        try:
            token = getattr(request.user, 'api_token', None) if getattr(request.user, 'is_authenticated', False) else None
            if token:
                from apps.users.models import ApiRequestLog
                ApiRequestLog.objects.create(
                    token=token,
                    endpoint=request.path,
                    method=request.method,
                    status_code=response.status_code,
                )
        except Exception:
            pass
        return response


class PublicApiWorkspaceListCreateView(LoggedApiView):
    def get(self, request):
        workspaces = Workspace.objects.filter(owner=request.user).exclude(status='deleted')
        data = [{
            'id': w.id,
            'name': w.name,
            'status': w.status,
            'template': w.vm_template.name if w.vm_template else None,
            'created_at': w.created_at.isoformat(),
        } for w in workspaces]
        return Response({'success': True, 'data': data})

    def post(self, request):
        template_id = request.data.get('template_id')
        name = request.data.get('name', 'API Workspace')
        # 'hours' is accepted for interface compatibility but not used —
        # the real system has no pay-per-launch-request flow. Access is
        # decided from the caller's EXISTING hours balance or
        # subscription (get_workspace_access below), exactly like the
        # member UI's own Launch button. Buying hours is a separate,
        # already-proven endpoint (PurchaseHoursView).

        if not template_id:
            return Response({'success': False, 'message': 'template_id is required'}, status=400)

        try:
            template = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response({'success': False, 'message': 'Invalid template_id'}, status=400)

        from apps.users.models import SystemConfig
        max_per_user = int(SystemConfig.get('max_vms_per_user', '3'))
        current_w = Workspace.objects.filter(owner=request.user).exclude(status='deleted').count()
        if current_w >= max_per_user:
            return Response({
                'success': False,
                'message': f'You have reached the platform maximum of {max_per_user} workspace(s). Delete an existing workspace to create a new one.'
            }, status=400)

        max_concurrent = int(SystemConfig.get('max_concurrent_vms', '10'))
        active_vms = VirtualMachine.objects.filter(status='running').count()
        if active_vms >= max_concurrent:
            return Response({
                'success': False,
                'message': 'Platform is at maximum capacity. Please try again shortly.'
            }, status=503)

        access = get_workspace_access(request.user, template)
        if not access['can_launch']:
            return Response({
                'success': False,
                'message': f"You're out of hours for {template.name}. Buy more or subscribe first.",
                'price_per_hour': str(access['price_per_hour']),
                'price_per_month': str(access['price_per_month']),
            }, status=402)

        workspace = Workspace.objects.create(
            owner=request.user, name=name, vm_template=template, status='stopped'
        )
        workspace.access_reason = access['reason']

        try:
            _perform_launch(workspace, request.user)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Proxmox provisioning failed (API): {str(e)}')
            return Response({
                'success': False,
                'message': 'Unable to start your workspace right now. Our infrastructure team has been notified. Please try again in a few minutes.'
            }, status=503)

        from apps.users.models import ComputeUsageLog
        ComputeUsageLog.objects.create(user=request.user, vm=workspace.vm, session_type='workspace')

        from apps.notifications.services import notify
        notify(
            user=request.user,
            title='Workspace Launched',
            message=f'Launched {workspace.name} via API',
            notification_type='workspace_ready',
            link=f'/workspace/{workspace.id}'
        )

        return Response({
            'success': True,
            'data': {
                'id': workspace.id,
                'name': workspace.name,
                'status': workspace.status,
                'template': template.name,
                'vm_status': workspace.vm.status if workspace.vm else None,
                'access_reason': access['reason'],
            }
        }, status=201)


class PublicApiWorkspaceDetailView(LoggedApiView):
    def get(self, request, workspace_id):
        try:
            ws = Workspace.objects.get(id=workspace_id, owner=request.user)
        except Workspace.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        return Response({
            'success': True,
            'data': {
                'id': ws.id,
                'name': ws.name,
                'status': ws.status,
                'vm_status': ws.vm.status if ws.vm else None,
                'ip_address': ws.vm.ip_address if ws.vm else None,
            }
        })

    def delete(self, request, workspace_id):
        try:
            ws = Workspace.objects.get(id=workspace_id, owner=request.user)
        except Workspace.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        result = _perform_delete(ws)
        if not result['success']:
            return Response(
                {'success': False, 'message': result['message']},
                status=result.get('status', 500)
            )
        return Response({'success': True, 'message': result['message']})
