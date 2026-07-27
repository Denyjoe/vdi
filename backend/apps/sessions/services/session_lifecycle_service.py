from apps.vms.services.vm_orchestrator import VMOrchestrator

class SessionLifecycleService:
    @staticmethod
    def handle_participant_join(participant):
        """Handle participant joining a session by provisioning their VM."""
        participant.status = 'joined'
        participant.save()
        
        session = participant.session
        template = session.required_vm_template
        
        if not template:
            return
            
        if not participant.vm:
            from apps.vms.models import VirtualMachine
            
            vm = VirtualMachine.objects.create(
                name=f"session-{session.id}-{participant.user.username}",
                owner=participant.user,
                template=template,
                status='provisioning'
            )
            participant.vm = vm
            participant.save()
            
            orchestrator = VMOrchestrator()
            if template.is_real:
                import threading
                thread = threading.Thread(target=orchestrator.provision_real_vm, args=(vm,))
                thread.daemon = True
                thread.start()
            else:
                orchestrator.provision_vm(vm)

    @staticmethod
    def handle_participant_disconnect(participant):
        """Handle participant voluntarily disconnecting."""
        participant.status = 'disconnected'
        participant.save()
        
        if participant.vm:
            VMOrchestrator.deprovision_real_vm(participant.vm)
            participant.vm = None
            participant.vm_status = 'stopped'
            participant.save()
            
    @staticmethod
    def handle_participant_removal(participant):
        """Handle host removing a participant."""
        participant.status = 'removed'
        participant.save()
        
        if participant.vm:
            VMOrchestrator.deprovision_real_vm(participant.vm)
            participant.vm = None
            participant.vm_status = 'stopped'
            participant.save()

    @staticmethod
    def end_live_session(session):
        """End the entire session and cleanup all participants."""
        session.status = 'ended'
        session.save()
        
        for participant in session.participants.all():
            if participant.status not in ['removed', 'disconnected']:
                participant.status = 'disconnected'
                if participant.vm:
                    VMOrchestrator.deprovision_real_vm(participant.vm)
                    participant.vm = None
                    participant.vm_status = 'stopped'
                participant.save()
