"""
Admin VM Pool management API views.

Provides endpoints for admin to manage the pre-cloned VM pool:
    - GET  /api/vms/admin/pool/status/      → Pool stats + all entries
    - POST /api/vms/admin/pool/create/      → Pre-clone VMs (background)
    - POST /api/vms/admin/pool/cleanup/     → Remove error VMs
    - DELETE /api/vms/admin/pool/<id>/      → Delete specific entry
    - GET  /api/vms/admin/templates/        → Templates with pool counts
    - POST /api/vms/admin/templates/<id>/link/ → Link to Proxmox template
"""

import threading
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.users.permissions import IsAdmin
from apps.vms.models import VMTemplate, VMPoolEntry
from apps.vms.services.pool_service import VMPoolService

logger = logging.getLogger(__name__)


class PoolStatusView(APIView):
    """
    GET /api/vms/admin/pool/status/

    Returns pool statistics and a list of all pool entries
    for the admin dashboard.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        """
        Return pool stats and detailed entry list.

        Returns:
            Response: JSON with 'stats' and 'entries' keys.
        """
        pool = VMPoolService()
        stats = pool.get_pool_status()

        entries = (
            VMPoolEntry.objects
            .select_related('template', 'assigned_to')
            .order_by('-created_at')
        )

        entries_data = [
            {
                'id': e.id,
                'template': e.template.name,
                'template_id': e.template.id,
                'proxmox_vmid': e.proxmox_vmid,
                'ip_address': e.ip_address,
                'status': e.status,
                'assigned_to': e.assigned_to.email if e.assigned_to else None,
                'created_at': e.created_at.isoformat(),
                'assigned_at': e.assigned_at.isoformat() if e.assigned_at else None,
            }
            for e in entries
        ]

        return Response({
            'success': True,
            'stats': stats,
            'entries': entries_data,
        })


class PoolCreateView(APIView):
    """
    POST /api/vms/admin/pool/create/

    Body: {"template_id": 1, "count": 2}

    Creates VMs in a background thread so admin doesn't wait
    for the 5–10 minute clone process.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    MAX_BATCH_SIZE = 5

    def post(self, request):
        """
        Trigger background VM creation for the pool.

        Args:
            request: Must contain template_id (int) and count (int, 1-5).

        Returns:
            Response: Confirmation with count and template name.
        """
        template_id = request.data.get('template_id')
        count = int(request.data.get('count', 1))

        if count > self.MAX_BATCH_SIZE:
            return Response(
                {'success': False, 'message': f'Max {self.MAX_BATCH_SIZE} VMs at a time'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            template = VMTemplate.objects.get(id=template_id, is_real=True)
        except VMTemplate.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Real template not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        def _create_vms():
            """Background worker to create pool VMs."""
            pool = VMPoolService()
            for i in range(count):
                logger.info("Creating pool VM %d/%d for %s", i + 1, count, template.name)
                pool.create_pool_vm(template)

        thread = threading.Thread(target=_create_vms, daemon=True)
        thread.start()

        return Response({
            'success': True,
            'message': (
                f'Creating {count} VM(s) for "{template.name}" in background. '
                f'Check pool status for progress.'
            ),
            'template': template.name,
            'count': count,
        })


class PoolCleanupView(APIView):
    """
    POST /api/vms/admin/pool/cleanup/

    Removes error VMs from pool and Proxmox.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        """
        Clean up all pool entries in error state.

        Returns:
            Response: Count of cleaned entries.
        """
        pool = VMPoolService()
        cleaned = pool.cleanup_errors()
        return Response({
            'success': True,
            'message': f'Cleaned up {cleaned} error VM(s)',
        })


class PoolDeleteEntryView(APIView):
    """
    DELETE /api/vms/admin/pool/<entry_id>/

    Delete a specific pool entry and its Proxmox VM.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, entry_id):
        """
        Delete a specific pool entry, cleaning up Proxmox and Guacamole.

        Args:
            entry_id (int): The pool entry ID to delete.

        Returns:
            Response: Confirmation message.
        """
        try:
            entry = VMPoolEntry.objects.get(id=entry_id)
        except VMPoolEntry.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Entry not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        pool = VMPoolService()

        if entry.guacamole_connection_id:
            try:
                pool.guacamole.delete_connection(entry.guacamole_connection_id)
            except Exception:
                pass

        if entry.proxmox_vmid:
            try:
                pool.proxmox.delete_vm(entry.proxmox_vmid)
            except Exception:
                pass

        entry.delete()
        return Response({'success': True, 'message': 'Pool entry deleted'})


class PoolTemplateListView(APIView):
    """
    GET /api/vms/admin/templates/

    List templates with pool counts for admin management.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        """
        Return all templates with their pool ready/assigned counts.

        Returns:
            Response: List of template data with pool stats.
        """
        templates = VMTemplate.objects.all()
        data = []
        for t in templates:
            ready_count = VMPoolEntry.objects.filter(template=t, status='ready').count()
            assigned_count = VMPoolEntry.objects.filter(template=t, status='assigned').count()
            data.append({
                'id': t.id,
                'name': t.name,
                'os': t.os,
                'cpu_cores': t.cpu_cores,
                'ram_gb': t.ram_gb,
                'is_real': t.is_real,
                'proxmox_template_id': t.proxmox_template_id,
                'pool_ready': ready_count,
                'pool_assigned': assigned_count,
            })
        return Response({'success': True, 'data': data})


class TemplateLinkView(APIView):
    """
    POST /api/vms/admin/templates/<template_id>/link/

    Body: {"proxmox_template_id": 9000}

    Link a CloudDesk template to a Proxmox template VM.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, template_id):
        """
        Link or unlink a template to a Proxmox template ID.

        Args:
            template_id (int): The CloudDesk template ID.
            request.data: Must contain proxmox_template_id (int or null).

        Returns:
            Response: Confirmation with link status.
        """
        try:
            template = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        proxmox_id = request.data.get('proxmox_template_id')

        if proxmox_id is not None:
            template.proxmox_template_id = int(proxmox_id)
            template.is_real = True
        else:
            template.proxmox_template_id = None
            template.is_real = False

        template.save()

        return Response({
            'success': True,
            'message': (
                f'Template "{template.name}" linked to '
                f'Proxmox {template.proxmox_template_id}'
            ),
            'is_real': template.is_real,
        })
