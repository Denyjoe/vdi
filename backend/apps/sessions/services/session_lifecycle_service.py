from apps.vms.services.vm_orchestrator import VMOrchestrator

class SessionLifecycleService:
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
