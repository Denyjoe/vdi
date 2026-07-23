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
    def start_real_vm(self, workspace):
        """
        Start an existing real VM (Power Up flow).
        """
        vm = workspace.vm
        vm.status = 'provisioning'
        vm.save()
        
        try:
            from apps.vms.services.proxmox_service import get_proxmox_service
            from apps.vms.services.guacamole_service import get_guacamole_service
            from decouple import config
            import time
            from django.utils import timezone
            
            proxmox = get_proxmox_service()
            guacamole = get_guacamole_service()
            
            if not vm.proxmox_vm_id:
                raise Exception("VM does not have a proxmox_vm_id")
                
            proxmox.start_vm(vm.proxmox_vm_id)
            
            ASSIGN_IP_WAIT_SECONDS = 120
            ip_address = proxmox.get_vm_ip(vm.proxmox_vm_id, max_wait=ASSIGN_IP_WAIT_SECONDS)
            if not ip_address:
                raise Exception('VM did not acquire IP address within timeout')
                
            vm.ip_address = ip_address
            vm.save()

            # Wait for RDP to be genuinely ready (TCP port check)
            import socket
            def wait_for_rdp_ready(ip, port=3389, timeout=90, poll_interval=2):
                """Wait until xrdp is actually accepting connections."""
                elapsed = 0
                while elapsed < timeout:
                    try:
                        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        sock.settimeout(3)
                        result = sock.connect_ex((ip, port))
                        sock.close()
                        if result == 0:
                            return True
                    except Exception:
                        pass
                    time.sleep(poll_interval)
                    elapsed += poll_interval
                return False

            vm.notes = 'Waiting for remote desktop service to start...'
            vm.save(update_fields=['notes'])

            rdp_ready = wait_for_rdp_ready(ip_address, timeout=90)
            if not rdp_ready:
                # Clean up the orphaned Proxmox VM
                try:
                    proxmox.delete_vm_completely(vm.proxmox_vm_id)
                except Exception as cleanup_err:
                    import logging
                    logging.getLogger(__name__).error(
                        f'Failed to clean up orphaned VM {vm.proxmox_vm_id} '
                        f'after RDP timeout: {cleanup_err}')
                vm.status = 'error'
                vm.notes = (
                    'VM started but the remote desktop service did not '
                    'become ready in time. The VM has been cleaned up. '
                    'Please try again.')
                vm.save()
                workspace.status = 'error'
                workspace.save()
                return {'error': 'RDP port did not become ready'}

            session_restrictions = {}
            try:
                from apps.sessions.models import SessionParticipant
                participant = SessionParticipant.objects.filter(vm=vm).first()
                if participant and participant.session:
                    session_restrictions = participant.session.restrictions
            except ImportError:
                pass
                
            if vm.guacamole_connection_id:
                try:
                    guacamole.delete_connection(vm.guacamole_connection_id)
                except Exception:
                    pass
            
            clone_name = f'vm-{vm.owner.id}-{vm.id}'
            try:
                conn_id = guacamole.create_connection(
                    name=clone_name,
                    hostname=ip_address,
                    username=config('VM_DEFAULT_USER', default='student'),
                    password=config('VM_DEFAULT_PASSWORD', default='student123'),
                    restrictions=session_restrictions
                )
                if not conn_id:
                    raise Exception('Guacamole connection failed: create_connection returned None')
                vm.guacamole_connection_id = conn_id
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(
                    f'Guacamole connection failed '
                    f'for VM {vm.id}: {str(e)}',
                    exc_info=True)
                # Clean up the orphaned Proxmox VM
                try:
                    proxmox.delete_vm_completely(vm.proxmox_vm_id)
                except Exception as cleanup_err:
                    logger.error(
                        f'Failed to clean up orphaned VM {vm.proxmox_vm_id} '
                        f'after Guacamole failure: {cleanup_err}')
                vm.status = 'error'
                vm.notes = (
                    'VM started successfully but '
                    'failed to connect to the '
                    'remote desktop service. '
                    'The VM has been cleaned up. '
                    'Please try again or contact '
                    'support.')
                vm.save()
                workspace.status = 'error'
                workspace.save()
                return {'error': f'Guacamole connection failed: {str(e)}'}
            
            vm.status = 'running'
            vm.started_at = timezone.now()
            vm.save()
            
            workspace.status = 'active'
            workspace.save()
            
            self._log_activity(vm, 'VM_REAL_STARTED', {
                'vmid': vm.proxmox_vm_id,
                'ip': ip_address,
                'guacamole_connection': conn_id,
            })
            
            return {
                'status': 'running',
                'vmid': vm.proxmox_vm_id,
                'ip': ip_address,
                'guacamole_connection': conn_id,
            }
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(
                f'Provisioning update failed '
                f'for workspace {workspace.id}: '
                f'{str(e)}', exc_info=True)
            # Also update status to reflect the real problem instead of leaving it stuck
            workspace.vm.status = 'error'
            workspace.vm.notes = f'Update failed: {str(e)}'
            workspace.vm.save()
            return {'error': str(e)}

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
        print(f'[THREAD START] provision_real_vm called for VM {vm.id}')
        try:
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
            vm.notes = 'Cloning template...'
            vm.save(update_fields=['status', 'notes'])

            from apps.vms.services.proxmox_service import get_proxmox_service
            from apps.vms.services.guacamole_service import get_guacamole_service
            from decouple import config

            proxmox = get_proxmox_service()
            guacamole = get_guacamole_service()

            clone_name = f'vm-{vm.owner.id}-{vm.id}'
            new_vmid = proxmox.clone_template(
                template.proxmox_template_id, clone_name)

            vm.proxmox_vm_id = new_vmid
            vm.notes = 'Starting virtual machine...'
            vm.save(update_fields=['proxmox_vm_id', 'notes'])

            proxmox.start_vm(new_vmid)

            DIRECT_CLONE_IP_WAIT = 90
            
            def ip_progress_cb(waited):
                vm.notes = f'Waiting for network ({waited}s)...'
                vm.save(update_fields=['notes'])

            ip_address = proxmox.get_vm_ip(new_vmid, max_wait=DIRECT_CLONE_IP_WAIT, progress_callback=ip_progress_cb)

            if not ip_address:
                vm.status = 'error'
                vm.notes = ('Failed to detect network after clone. The VM may still be '
                            'booting — try refreshing in a moment, or contact support if this persists.')
                vm.save(update_fields=['status', 'notes'])
                self._log_activity(vm, 'VM_PROVISION_FAILED', {'reason': 'no_ip'})
                return {'error': 'VM did not get IP'}

            vm.ip_address = ip_address
            vm.save()

            # Wait for RDP to be genuinely ready
            import socket
            def wait_for_rdp_ready(ip, port=3389, timeout=90, poll_interval=2):
                """Wait until xrdp is actually accepting connections."""
                elapsed = 0
                while elapsed < timeout:
                    try:
                        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        sock.settimeout(3)
                        result = sock.connect_ex((ip, port))
                        sock.close()
                        if result == 0:
                            return True
                    except Exception:
                        pass
                    time.sleep(poll_interval)
                    elapsed += poll_interval
                return False

            vm.notes = 'Waiting for remote desktop service to start...'
            vm.save(update_fields=['notes'])

            rdp_ready = wait_for_rdp_ready(ip_address, timeout=90)
            if not rdp_ready:
                # Clean up the orphaned Proxmox VM
                try:
                    from apps.vms.services.proxmox_service import get_proxmox_service
                    get_proxmox_service().delete_vm_completely(vm.proxmox_vm_id)
                except Exception as cleanup_err:
                    import logging
                    logging.getLogger(__name__).error(
                        f'Failed to clean up orphaned VM {vm.proxmox_vm_id} '
                        f'after RDP timeout: {cleanup_err}')
                vm.status = 'error'
                vm.notes = (
                    'VM started but the remote desktop service did not '
                    'become ready in time. The VM has been cleaned up. '
                    'Please try again.')
                vm.save()
                workspace = vm.workspace_set.first()
                if workspace:
                    workspace.status = 'error'
                    workspace.save()
                return {'error': 'RDP port did not become ready'}

            session_restrictions = {}
            try:
                from apps.sessions.models import SessionParticipant
                participant = SessionParticipant.objects.filter(vm=vm).first()
                if participant and participant.session:
                    session_restrictions = participant.session.restrictions
            except ImportError:
                pass

            try:
                conn_id = guacamole.create_connection(
                    name=clone_name,
                    hostname=ip_address,
                    username=config('VM_DEFAULT_USER', default='student'),
                    password=config('VM_DEFAULT_PASSWORD', default='student123'),
                    restrictions=session_restrictions
                )
                if not conn_id:
                    raise Exception('Guacamole connection failed: create_connection returned None')
                vm.guacamole_connection_id = conn_id
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(
                    f'Guacamole connection failed '
                    f'for VM {vm.id}: {str(e)}',
                    exc_info=True)
                # Clean up the orphaned Proxmox VM
                try:
                    from apps.vms.services.proxmox_service import get_proxmox_service
                    get_proxmox_service().delete_vm_completely(vm.proxmox_vm_id)
                except Exception as cleanup_err:
                    logger.error(
                        f'Failed to clean up orphaned VM {vm.proxmox_vm_id} '
                        f'after Guacamole failure: {cleanup_err}')
                vm.status = 'error'
                vm.notes = (
                    'VM started successfully but '
                    'failed to connect to the '
                    'remote desktop service. '
                    'The VM has been cleaned up. '
                    'Please try again or contact '
                    'support.')
                vm.save()
                workspace = vm.workspace_set.first()
                if workspace:
                    workspace.status = 'error'
                    workspace.save()
                return {'error': f'Guacamole connection failed: {str(e)}'}

            vm.status = 'running'
            vm.notes = ''
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
            print(f'[THREAD CRASHED] {str(exc)}')
            import traceback
            traceback.print_exc()
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

        errors = []
        try:
            if vm.guacamole_connection_id:
                guacamole = get_guacamole_service()
                try:
                    guacamole.delete_connection(vm.guacamole_connection_id)
                except Exception as e:
                    errors.append(f"Guacamole: {str(e)}")

            if vm.proxmox_vm_id:
                proxmox = get_proxmox_service()
                try:
                    proxmox.delete_vm(vm.proxmox_vm_id)
                except Exception as e:
                    errors.append(f"Proxmox: {str(e)}")

            if errors:
                raise Exception(' | '.join(errors))

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
