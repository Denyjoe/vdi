from celery import shared_task
from django.utils import timezone
import random
import time

@shared_task(bind=True, max_retries=3)
def provision_vm_task(self, vm_id):
  """
  Replaces the Python thread in 
  vm_orchestrator.provision_vm()
  Runs in a Celery worker process.
  """
  try:
    from apps.vms.models import VirtualMachine
    from apps.sessions.models import ActivityLog
    from apps.users.models import User
    
    vm = VirtualMachine.objects.get(id=vm_id)
    
    # Update status to provisioning
    vm.status = 'provisioning'
    vm.save()
    
    # Log start
    ActivityLog.objects.create(
      user=vm.owner,
      action='VM_PROVISIONING_STARTED',
      description=f'Provisioning {vm.name}',
      metadata={'vm_id': vm_id}
    )
    
    # Simulate provisioning time
    # In production this calls Proxmox API
    time.sleep(8)
    
    # Update to running
    vm.status = 'running'
    vm.started_at = timezone.now()
    vm.cpu_usage = round(
      random.uniform(5.0, 25.0), 1)
    vm.ram_usage = round(
      random.uniform(20.0, 45.0), 1)
    vm.save()
    
    # Log completion
    ActivityLog.objects.create(
      user=vm.owner,
      action='VM_RUNNING',
      description=f'{vm.name} is now running',
      metadata={'vm_id': vm_id}
    )
    
    return {
      'vm_id': vm_id,
      'status': 'running',
      'message': f'{vm.name} provisioned'
    }
    
  except VirtualMachine.DoesNotExist:
    return {'error': f'VM {vm_id} not found'}
  except Exception as exc:
    # Retry on failure
    raise self.retry(
      exc=exc, countdown=10)


@shared_task(bind=True)
def end_practical_session_task(self, practical_id):
  """
  Auto-ends a practical session 
  when deadline passes.
  Scheduled when session is created.
  """
  try:
    from apps.sessions.models import (
      PracticalSession,
      StudentPracticalAccess)
    
    session = PracticalSession.objects\
      .get(id=practical_id)
    
    if session.status == 'active':
      session.status = 'ended'
      session.save()
      
      # Mark missed students
      StudentPracticalAccess.objects\
        .filter(
          practical_session=session,
          status='not_started'
        ).update(status='missed')
      
      ActivityLog.objects.create(
        user=session.lecturer,
        action='PRACTICAL_AUTO_ENDED',
        description=f'Auto-ended: {session.name}',
        metadata={'practical_id': practical_id}
      )
    
    return {
      'practical_id': practical_id,
      'status': 'ended'
    }
  
  except Exception as exc:
    raise self.retry(
      exc=exc, countdown=30)


@shared_task
def cleanup_stale_vms():
  """
  Periodic task to clean up VMs 
  stuck in provisioning state.
  Runs every 30 minutes.
  """
  from apps.vms.models import VirtualMachine
  from django.utils import timezone
  import datetime
  
  # VMs stuck provisioning > 10 minutes
  cutoff = timezone.now() - \
    datetime.timedelta(minutes=10)
  
  stale = VirtualMachine.objects.filter(
    status='provisioning',
    allocated_at__lt=cutoff
  )
  
  count = stale.count()
  stale.update(status='error')
  
  return {
    'cleaned_up': count,
    'message': f'Set {count} stale VMs to error'
  }


@shared_task
def cleanup_expired_sessions():
  """
  Periodic task to disconnect 
  sessions that exceeded max hours.
  Runs every hour.
  """
  from apps.sessions.models import RemoteSession
  from apps.users.models import SystemConfig
  from django.utils import timezone
  import datetime
  
  max_hours = int(SystemConfig.get(
    'max_session_hours', '8'))
  
  cutoff = timezone.now() - \
    datetime.timedelta(hours=max_hours)
  
  expired = RemoteSession.objects.filter(
    status='active',
    started_at__lt=cutoff
  )
  
  count = expired.count()
  
  for session in expired:
    session.status = 'disconnected'
    session.ended_at = timezone.now()
    diff = session.ended_at - session.started_at
    session.duration_seconds = int(diff.total_seconds())
    session.save()
  
  return {
    'expired_sessions': count
  }
