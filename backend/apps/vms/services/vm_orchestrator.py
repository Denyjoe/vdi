"""
VM Orchestrator — central control point for all VM lifecycle operations.

Handles both simulated VMs (for development) and real Proxmox VMs
(for production). Real VM provisioning tries the pre-cloned pool first
for instant assignment (~30s), falling back to direct clone (~5min).

All VM provisioning, starting, stopping, and deletion flows through
this single orchestrator.
"""

import threading
import time
import random
from django.utils import timezone
from apps.notifications.services import send_notification
from apps.sessions.models import ActivityLog


class VMOrchestrator:
    """
    Central orchestrator for VM lifecycle management.

    Supports two modes:
        - Simulated: Uses threading/Celery to simulate provisioning.
        - Real: Uses Proxmox pool (fast) or direct clone (slow).
    """

    def _log_activity(self, vm, action, metadata=None):
        """
        Log a VM lifecycle activity.

        Args:
            vm (VirtualMachine): The VM this activity relates to.
            action (str): The action identifier (e.g. 'VM_RUNNING').
            metadata (dict): Optional additional data to log.
        """
        if metadata is None:
            metadata = {}
        metadata['vm_id'] = vm.id
        metadata['vm_name'] = vm.name

        ActivityLog.objects.create(
            user=vm.owner,
            action=action,
            metadata=metadata,
        )

    def provision_vm(self, vm):
        """
        Provision a simulated VM (development mode).

        Tries Celery first, falls back to a background thread.

        Args:
            vm (VirtualMachine): The VM to provision.

        Returns:
            str or None: Celery task ID, or None if using thread fallback.
        """
        self._log_activity(vm, 'VM_PROVISIONING_STARTED')

        try:
            from apps.vms.tasks import provision_vm_task
            result = provision_vm_task.delay(vm.id)
            print(f'VM {vm.id} dispatched to Celery worker (Task: {result.id})')
            return result.id
        except Exception as e:
            print(f'Celery unavailable, using thread: {e}')
            vm.status = 'provisioning'
            vm.save()
            thread = threading.Thread(target=self._provision_sync, args=(vm.id,))
            thread.daemon = True
            thread.start()
            return None

    def _provision_sync(self, vm_id):
        """
        Fallback sync provisioning via background thread.

        Simulates an 8-second provisioning delay, then marks
        the VM as running with randomised resource usage.

        Args:
            vm_id (int): The VirtualMachine ID to provision.
        """
        from apps.vms.models import VirtualMachine

        try:
            vm = VirtualMachine.objects.get(id=vm_id)
            time.sleep(8)
            vm.refresh_from_db()
            if vm.status == 'deleted':
                return
            vm.status = 'running'
            vm.started_at = timezone.now()
            vm.cpu_usage = round(random.uniform(5.0, 25.0), 1)
            vm.ram_usage = round(random.uniform(20.0, 45.0), 1)
            vm.save()
            self._log_activity(vm, 'VM_RUNNING')
        except VirtualMachine.DoesNotExist:
            pass

    def stop_vm(self, vm):
        """
        Stop a VM and reset resource usage.

        Args:
            vm (VirtualMachine): The VM to stop.
        """
        vm.status = 'stopped'
        vm.stopped_at = timezone.now()
        vm.cpu_usage = 0.0
        vm.ram_usage = 0.0
        vm.save()
        self._log_activity(vm, 'VM_STOPPED')

    def start_vm(self, vm):
        """
        Start a stopped VM.

        Args:
            vm (VirtualMachine): The VM to start.
        """
        vm.status = 'provisioning'
        vm.save()
        self._log_activity(vm, 'VM_START_REQUESTED')

        try:
            from apps.vms.tasks import provision_vm_task
            provision_vm_task.delay(vm.id)
        except Exception as e:
            print(f'Celery unavailable, using thread: {e}')
            thread = threading.Thread(target=self._provision_sync, args=(vm.id,))
            thread.daemon = True
            thread.start()

    def delete_vm(self, vm):
        """
        Mark a VM as deleted.

        Args:
            vm (VirtualMachine): The VM to delete.
        """
        vm.status = 'deleted'
        vm.save()
        self._log_activity(vm, 'VM_DELETED')

    def get_vm_status(self, vm):
        """
        Get current VM status with simulated resource fluctuation.

        Args:
            vm (VirtualMachine): The VM to check.

        Returns:
            dict: Status info with keys: status, cpu_usage, ram_usage,
                  uptime_seconds, can_connect.
        """
        if vm.status == 'running':
            cpu_delta = random.uniform(-2.0, 2.0)
            vm.cpu_usage = max(0.0, min(100.0, float(vm.cpu_usage) + cpu_delta))

            ram_delta = random.uniform(-1.0, 1.0)
            vm.ram_usage = max(0.0, min(100.0, float(vm.ram_usage) + ram_delta))

            vm.cpu_usage = round(vm.cpu_usage, 1)
            vm.ram_usage = round(vm.ram_usage, 1)
            vm.save()

        uptime = 0
        if vm.started_at and vm.status == 'running':
            uptime = int((timezone.now() - vm.started_at).total_seconds())

        return {
            'status': vm.status,
            'cpu_usage': vm.cpu_usage,
            'ram_usage': vm.ram_usage,
            'uptime_seconds': uptime,
            'can_connect': vm.status == 'running',
        }

    def provision_real_vm(self, vm):
        """
        Provision a real VM. Uses pool first (fast, ~30s).
        Falls back to direct clone if pool is empty (slow, ~5min).

        Args:
            vm (VirtualMachine): The VM instance to provision.

        Returns:
            dict: Result with status, vmid, ip, guacamole_connection,
                  guacamole_url on success, or error message on failure.
        """
        from apps.vms.services.pool_service import VMPoolService

        template = vm.template

        if not template.is_real or not template.proxmox_template_id:
            return self.provision_vm(vm)

        pool = VMPoolService()

        # Try pool first (fast path)
        result = pool.assign_vm_to_user(template, vm.owner, vm)

        if 'error' not in result:
            self._log_activity(vm, 'VM_POOL_ASSIGNED', {
                'vmid': result.get('vmid'),
                'ip': result.get('ip'),
            })
            return result

        # Pool empty — fall back to direct clone (slow path)
        vm.status = 'provisioning'
        vm.save()

        try:
            from apps.vms.services.proxmox_service import get_proxmox_service
            from apps.vms.services.guacamole_service import get_guacamole_service
            from decouple import config

            proxmox = get_proxmox_service()
            guacamole = get_guacamole_service()

            clone_name = f'vm-{vm.owner.id}-{vm.id}'
            new_vmid = proxmox.clone_template(
                template.proxmox_template_id, clone_name)

            vm.proxmox_vm_id = new_vmid
            vm.save()

            proxmox.start_vm(new_vmid)

            DIRECT_CLONE_IP_WAIT = 300
            ip_address = proxmox.get_vm_ip(new_vmid, max_wait=DIRECT_CLONE_IP_WAIT)

            if not ip_address:
                vm.status = 'error'
                vm.notes = 'VM did not acquire IP address within timeout'
                vm.save()
                self._log_activity(vm, 'VM_PROVISION_FAILED', {'reason': 'no_ip'})
                return {'error': 'VM did not get IP'}

            vm.ip_address = ip_address
            vm.save()

            RDP_READY_WAIT = 15
            time.sleep(RDP_READY_WAIT)

            conn_id = guacamole.create_connection(
                name=clone_name,
                hostname=ip_address,
                username=config('VM_DEFAULT_USER', default='student'),
                password=config('VM_DEFAULT_PASSWORD', default='student123'),
            )

            vm.guacamole_connection_id = conn_id or ''
            vm.status = 'running'
            vm.started_at = timezone.now()
            vm.save()

            guac_url = guacamole.get_connection_url(conn_id) if conn_id else ''

            self._log_activity(vm, 'VM_REAL_PROVISIONED', {
                'vmid': new_vmid,
                'ip': ip_address,
                'guacamole_connection': conn_id,
            })

            return {
                'status': 'running',
                'vmid': new_vmid,
                'ip': ip_address,
                'guacamole_connection': conn_id,
                'guacamole_url': guac_url,
            }

        except Exception as exc:
            vm.status = 'error'
            vm.notes = str(exc)
            vm.save()
            self._log_activity(vm, 'VM_PROVISION_FAILED', {'error': str(exc)})
            return {'error': str(exc)}

    def deprovision_real_vm(self, vm):
        """
        Delete the Proxmox VM and its Guacamole connection.

        Cleans up both infrastructure resources. Safe to call even
        if one or both resources don't exist.

        Args:
            vm (VirtualMachine): The VM to tear down.
        """
        from apps.vms.services.proxmox_service import get_proxmox_service
        from apps.vms.services.guacamole_service import get_guacamole_service

        try:
            if vm.guacamole_connection_id:
                guacamole = get_guacamole_service()
                guacamole.delete_connection(vm.guacamole_connection_id)

            if vm.proxmox_vm_id:
                proxmox = get_proxmox_service()
                proxmox.delete_vm(vm.proxmox_vm_id)

            vm.status = 'deleted'
            vm.save()
            self._log_activity(vm, 'VM_REAL_DELETED')

        except Exception as exc:
            vm.notes = f'Deprovision error: {exc}'
            vm.status = 'error'
            vm.save()
            self._log_activity(vm, 'VM_DEPROVISION_FAILED',
                               {'error': str(exc)})


orchestrator = VMOrchestrator()
