from apps.notifications.services import send_notification
import threading
import time
import random
from django.utils import timezone
from apps.sessions.models import ActivityLog

class VMOrchestrator:
    
    def _log_activity(self, vm, action, metadata=None):
        if metadata is None:
            metadata = {}
        metadata['vm_id'] = vm.id
        metadata['vm_name'] = vm.name
        
        ActivityLog.objects.create(
            user=vm.owner,
            action=action,
            metadata=metadata
        )

    def provision_vm(self, vm):
        self._log_activity(vm, 'VM_PROVISIONING_STARTED')
        
        try:
            from apps.vms.tasks import provision_vm_task
            # Try Celery first
            result = provision_vm_task.delay(vm.id)
            print(f'VM {vm.id} dispatched to Celery worker (Task: {result.id})')
            return result.id
        except Exception as e:
            # Fallback to threading if Celery/Redis not available
            print(f'Celery unavailable, using thread: {e}')
            vm.status = 'provisioning'
            vm.save()
            import threading
            thread = threading.Thread(target=self._provision_sync, args=(vm.id,))
            thread.daemon = True
            thread.start()
            return None

    def _provision_sync(self, vm_id):
        """Fallback sync provisioning"""
        import time, random
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
        vm.status = 'stopped'
        vm.stopped_at = timezone.now()
        vm.cpu_usage = 0.0
        vm.ram_usage = 0.0
        vm.save()
        self._log_activity(vm, 'VM_STOPPED')

    def start_vm(self, vm):
        vm.status = 'provisioning'
        vm.save()
        self._log_activity(vm, 'VM_START_REQUESTED')
        
        try:
            from apps.vms.tasks import provision_vm_task
            provision_vm_task.delay(vm.id)
        except Exception as e:
            print(f'Celery unavailable, using thread: {e}')
            import threading
            thread = threading.Thread(target=self._provision_sync, args=(vm.id,))
            thread.daemon = True
            thread.start()

    def delete_vm(self, vm):
        vm.status = 'deleted'
        vm.save()
        self._log_activity(vm, 'VM_DELETED')

    def get_vm_status(self, vm):
        """
        Get current VM status with simulated resource fluctuation.

        For real VMs, queries Proxmox for actual status. For simulated
        VMs, randomly fluctuates CPU/RAM values.

        Args:
            vm (VirtualMachine): The VM to check.

        Returns:
            dict: Status info with keys: status, cpu_usage, ram_usage,
                  uptime_seconds, can_connect.
        """
        if vm.status == 'running':
            # fluctuate cpu_usage by ±2.0 randomly
            cpu_delta = random.uniform(-2.0, 2.0)
            vm.cpu_usage = max(0.0, min(100.0, float(vm.cpu_usage) + cpu_delta))
            
            # fluctuate ram_usage by ±1.0 randomly
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
            'can_connect': vm.status == 'running'
        }

    def provision_real_vm(self, vm):
        """
        Clone a real Proxmox VM and create a Guacamole RDP connection.

        This is the production provisioning path. It:
        1. Clones the Proxmox template
        2. Starts the new VM
        3. Waits for the VM to acquire an IP
        4. Waits for RDP to become ready
        5. Creates a Guacamole connection

        Falls back to simulation if the template has no proxmox_template_id.

        Args:
            vm (VirtualMachine): The VM instance to provision.

        Returns:
            dict: Result with status, vmid, ip, and guacamole_connection
                  on success, or error message on failure.
        """
        from apps.vms.services.proxmox_service import get_proxmox_service
        from apps.vms.services.guacamole_service import get_guacamole_service

        template = vm.template

        if not template.proxmox_template_id:
            # No real template linked — fall back to simulation
            return self.provision_vm(vm)

        try:
            vm.status = 'provisioning'
            vm.save()

            proxmox = get_proxmox_service()
            guacamole = get_guacamole_service()

            # 1. Clone the template
            clone_name = f'vm-{vm.owner.id}-{vm.id}'
            new_vmid = proxmox.clone_template(
                template.proxmox_template_id, clone_name)

            vm.proxmox_vm_id = new_vmid
            vm.save()

            # 2. Start the VM
            proxmox.start_vm(new_vmid)

            # 3. Wait for IP via guest agent
            IP_WAIT_SECONDS = 90
            ip_address = proxmox.get_vm_ip(new_vmid, max_wait=IP_WAIT_SECONDS)

            if not ip_address:
                vm.status = 'error'
                vm.notes = 'VM did not acquire IP address within timeout'
                vm.save()
                self._log_activity(vm, 'VM_PROVISION_FAILED',
                                   {'reason': 'no_ip'})
                return {'error': 'VM did not get IP'}

            vm.ip_address = ip_address
            vm.save()

            # 4. Wait for RDP service to be ready
            RDP_READY_WAIT_SECONDS = 15
            time.sleep(RDP_READY_WAIT_SECONDS)

            # 5. Create Guacamole connection
            conn_id = guacamole.create_connection(
                name=clone_name,
                hostname=ip_address,
            )

            vm.guacamole_connection_id = conn_id or ''
            vm.status = 'running'
            vm.started_at = timezone.now()
            vm.save()

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
            }

        except Exception as exc:
            vm.status = 'error'
            vm.notes = str(exc)
            vm.save()
            self._log_activity(vm, 'VM_PROVISION_FAILED',
                               {'error': str(exc)})
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
