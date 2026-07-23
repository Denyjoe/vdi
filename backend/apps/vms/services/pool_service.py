"""
VM Pool management service.

Manages a pool of pre-cloned Proxmox VMs. Admin pre-clones VMs that sit
ready to be assigned. When a user launches a workspace, they get a ready
VM instantly (~30s to start). When done, VM is destroyed and pool is
refilled by admin.

This service handles:
    - Creating pool VMs (clone + configure + stop for readiness)
    - Assigning ready VMs to users
    - Releasing VMs back (destroy from Proxmox + Guacamole)
    - Pool status reporting for admin dashboard
    - Error cleanup
"""

import time
import logging
from django.utils import timezone
from django.db.models import Count
from decouple import config

logger = logging.getLogger(__name__)

# Timing constants
RDP_READY_WAIT_SECONDS = 15
STOP_SETTLE_SECONDS = 5
ASSIGN_IP_WAIT_SECONDS = 120
CLONE_IP_WAIT_SECONDS = 300


class VMPoolService:
    """
    Manages a pool of pre-cloned VMs for instant user assignment.

    Admin pre-clones VMs that sit ready. When a user launches, they
    get assigned a ready VM instantly (~30s to start). When done,
    VM is destroyed and pool can be refilled.
    """

    def __init__(self):
        """Initialise pool service with lazy Proxmox/Guacamole services."""
        from apps.vms.services.proxmox_service import get_proxmox_service
        from apps.vms.services.guacamole_service import get_guacamole_service
        self.proxmox = get_proxmox_service()
        self.guacamole = get_guacamole_service()

    def create_pool_vm(self, template):
        """
        Clone a single VM from template and add to pool.

        This is the slow operation (~5 min on HDD) that admin triggers
        BEFORE users need it. The VM is cloned, started to get an IP,
        Guacamole connection is created, then the VM is stopped (ready).

        Args:
            template (VMTemplate): The template to clone from.

        Returns:
            VMPoolEntry or None: The created pool entry.
        """
        from apps.vms.models import VMPoolEntry

        if not template.proxmox_template_id:
            logger.error("Template %s has no proxmox_template_id", template.name)
            return None

        entry = VMPoolEntry.objects.create(
            template=template,
            proxmox_vmid=0,
            status='creating',
        )

        try:
            # 1. Clone template
            clone_name = f'pool-{template.id}-{entry.id}'
            new_vmid = self.proxmox.clone_template(
                template.proxmox_template_id, clone_name)

            entry.proxmox_vmid = new_vmid
            entry.save()

            # 2. Start VM to get IP
            self.proxmox.start_vm(new_vmid)

            # 3. Wait for IP via guest agent
            ip_address = self.proxmox.get_vm_ip(
                new_vmid, max_wait=CLONE_IP_WAIT_SECONDS)

            if not ip_address:
                entry.status = 'error'
                entry.save()
                logger.error("Pool VM %s: no IP after %ss", new_vmid, CLONE_IP_WAIT_SECONDS)
                return entry

            entry.ip_address = ip_address
            entry.save()

            # 4. Wait for RDP to be ready
            time.sleep(RDP_READY_WAIT_SECONDS)

            # 5. Create Guacamole connection
            conn_id = self.guacamole.create_connection(
                name=clone_name,
                hostname=ip_address,
                username=config('VM_DEFAULT_USER', default='student'),
                password=config('VM_DEFAULT_PASSWORD', default='student123'),
            )

            if conn_id:
                entry.guacamole_connection_id = conn_id

            # 6. Stop VM — sits ready, starts fast when needed
            self.proxmox.stop_vm(new_vmid)
            time.sleep(STOP_SETTLE_SECONDS)

            entry.status = 'ready'
            entry.save()

            logger.info(
                "Pool VM %s ready (IP: %s, Guac: %s)",
                new_vmid, ip_address, conn_id,
            )
            return entry

        except Exception as exc:
            entry.status = 'error'
            entry.save()
            logger.error("Pool VM creation failed: %s", exc)
            return entry

    def assign_vm_to_user(self, template, user, vm_instance):
        """
        Assign a ready pool VM to a user and start it.

        Starts the VM — user gets desktop in ~30 seconds.

        Args:
            template (VMTemplate): The template type needed.
            user (User): The user to assign to.
            vm_instance (VirtualMachine): The VirtualMachine record.

        Returns:
            dict: Connection info on success, or error message.
        """
        from apps.vms.models import VMPoolEntry

        # Find a ready VM for this template
        entry = VMPoolEntry.objects.filter(
            template=template, status='ready',
        ).first()

        if not entry:
            return {
                'error': 'No VMs available in pool. Ask admin to pre-clone more VMs.',
            }

        try:
            # Mark as assigned
            entry.status = 'assigned'
            entry.assigned_to = user
            entry.assigned_vm = vm_instance
            entry.assigned_at = timezone.now()
            entry.save()

            # Start the VM
            self.proxmox.start_vm(entry.proxmox_vmid)

            # Wait for it to boot (already cloned, just booting)
            ip_address = self.proxmox.get_vm_ip(
                entry.proxmox_vmid, max_wait=ASSIGN_IP_WAIT_SECONDS)

            if ip_address and ip_address != entry.ip_address:
                # IP may have changed after stop/start — update Guacamole
                entry.ip_address = ip_address
                entry.save()

                # Delete old Guacamole connection
                if entry.guacamole_connection_id:
                    try:
                        self.guacamole.delete_connection(entry.guacamole_connection_id)
                    except Exception:
                        pass

                session_restrictions = {}
                try:
                    from apps.sessions.models import SessionParticipant
                    participant = SessionParticipant.objects.filter(vm=vm_instance).first()
                    if participant and participant.session:
                        session_restrictions = participant.session.restrictions
                except ImportError:
                    pass

                # Create new one with correct IP
                try:
                    conn_id = self.guacamole.create_connection(
                        name=f'user-{user.id}-vm-{entry.proxmox_vmid}',
                        hostname=ip_address,
                        username=config('VM_DEFAULT_USER', default='student'),
                        password=config('VM_DEFAULT_PASSWORD', default='student123'),
                        restrictions=session_restrictions
                    )
                    entry.guacamole_connection_id = conn_id
                    entry.save()
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f'Pool Guacamole connection failed: {e}', exc_info=True)
                    entry.status = 'error'
                    entry.notes = 'Failed to connect to remote desktop service'
                    entry.save()
                    vm_instance.status = 'error'
                    vm_instance.notes = entry.notes
                    vm_instance.save()
                    workspace = vm_instance.workspace_set.first()
                    if workspace:
                        workspace.status = 'error'
                        workspace.save()
                    return {'error': f'Guacamole connection failed: {e}'}

            # Update the VirtualMachine record
            vm_instance.proxmox_vm_id = entry.proxmox_vmid
            vm_instance.ip_address = entry.ip_address
            vm_instance.guacamole_connection_id = entry.guacamole_connection_id
            vm_instance.status = 'running'
            vm_instance.started_at = timezone.now()
            vm_instance.save()

            # Build the Guacamole URL
            guac_url = self.guacamole.get_connection_url(
                entry.guacamole_connection_id)

            return {
                'status': 'running',
                'vmid': entry.proxmox_vmid,
                'ip': entry.ip_address,
                'guacamole_connection': entry.guacamole_connection_id,
                'guacamole_url': guac_url,
            }

        except Exception as exc:
            entry.status = 'error'
            entry.save()
            return {'error': str(exc)}

    def release_vm(self, vm_instance):
        """
        Release a VM back — destroy it and remove from pool.

        Admin refills pool later. Cleans up both Guacamole connection
        and Proxmox VM, then deletes the pool entry.

        Args:
            vm_instance (VirtualMachine): The VM to release.
        """
        from apps.vms.models import VMPoolEntry

        entry = VMPoolEntry.objects.filter(assigned_vm=vm_instance).first()

        if entry:
            errors = []
            # Delete Guacamole connection
            if entry.guacamole_connection_id:
                try:
                    self.guacamole.delete_connection(entry.guacamole_connection_id)
                except Exception as e:
                    errors.append(f"Guacamole: {str(e)}")

            # Delete VM from Proxmox
            if entry.proxmox_vmid:
                try:
                    self.proxmox.delete_vm(entry.proxmox_vmid)
                except Exception as e:
                    errors.append(f"Proxmox: {str(e)}")

            if errors:
                entry.status = 'error'
                entry.notes = 'Release failed: ' + ' | '.join(errors)
                entry.save()
                raise Exception(entry.notes)

            entry.delete()

        vm_instance.status = 'deleted'
        vm_instance.save()

    def get_pool_status(self):
        """
        Get pool statistics for admin dashboard.

        Returns:
            dict: Pool stats with total, ready, assigned, creating,
                  error counts and per-template breakdown.
        """
        from apps.vms.models import VMPoolEntry

        entries = VMPoolEntry.objects.values(
            'template__name', 'status',
        ).annotate(count=Count('id'))

        return {
            'total': VMPoolEntry.objects.count(),
            'ready': VMPoolEntry.objects.filter(status='ready').count(),
            'assigned': VMPoolEntry.objects.filter(status='assigned').count(),
            'creating': VMPoolEntry.objects.filter(status='creating').count(),
            'error': VMPoolEntry.objects.filter(status='error').count(),
            'by_template': list(entries),
        }

    def cleanup_errors(self):
        """
        Clean up VMs with error status.

        Destroys from Proxmox and removes pool entries.

        Returns:
            int: Number of entries cleaned up.
        """
        from apps.vms.models import VMPoolEntry

        errors = VMPoolEntry.objects.filter(status='error')
        cleaned = 0
        for entry in errors:
            if entry.proxmox_vmid:
                try:
                    self.proxmox.delete_vm(entry.proxmox_vmid)
                    entry.delete()
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to clean broken pool entry {entry.id} (VM {entry.proxmox_vmid}): {e}")
            cleaned += 1
        return cleaned
