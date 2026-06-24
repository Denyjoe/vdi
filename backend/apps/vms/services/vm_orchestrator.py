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
        # Sets status = 'provisioning', saves
        vm.status = 'provisioning'
        vm.save()
        
        # Logs ActivityLog
        self._log_activity(vm, 'VM_PROVISIONING_STARTED')

        # Background thread for 8-second wait
        def run_provisioning():
            time.sleep(8)
            # Must refresh from db in case of concurrent updates, 
            # but for this simulation it's fine.
            vm.refresh_from_db()
            
            # If deleted during provisioning, stop.
            if vm.status == 'deleted':
                return
                
            vm.status = 'running'
            vm.started_at = timezone.now()
            vm.cpu_usage = round(random.uniform(5.0, 25.0), 1)
            vm.ram_usage = round(random.uniform(20.0, 45.0), 1)
            vm.save()
            
            self._log_activity(vm, 'VM_RUNNING')

        thread = threading.Thread(target=run_provisioning)
        thread.start()

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
        self.provision_vm(vm)

    def delete_vm(self, vm):
        vm.status = 'deleted'
        vm.save()
        self._log_activity(vm, 'VM_DELETED')

    def get_vm_status(self, vm):
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

orchestrator = VMOrchestrator()
