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
                def provision_and_update(vm_instance, part_instance):
                    try:
                        res = orchestrator.provision_real_vm(vm_instance)
                        if res and 'error' not in res:
                            part_instance.status = 'connected'
                        else:
                            part_instance.status = 'error'
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).error(
                            f"Participant {part_instance.id} VM provision failed: {e}", 
                            exc_info=True
                        )
                        part_instance.status = 'error'
                    finally:
                        part_instance.save()

                thread = threading.Thread(target=provision_and_update, args=(vm, participant))
                thread.daemon = True
                thread.start()
            else:
                try:
                    res = orchestrator.provision_vm(vm)
                    if res and 'error' not in res:
                        participant.status = 'connected'
                    else:
                        participant.status = 'error'
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(
                        f"Participant {participant.id} mock VM provision failed: {e}", 
                        exc_info=True
                    )
                    participant.status = 'error'
                finally:
                    participant.save()

    @staticmethod
    def handle_participant_disconnect(participant):
        """Handle participant voluntarily disconnecting."""
        SessionLifecycleService._cleanup_participant_vm(participant)
        participant.status = 'disconnected'
        participant.save()

    @staticmethod
    def _cleanup_participant_vm(participant):
        """Helper to cleanly delete a participant's VM from Proxmox and Guacamole."""
        if not participant.vm:
            return
            
        try:
            from apps.vms.services.guacamole_service import GuacamoleService
            if getattr(participant.vm, 'guacamole_connection_id', None):
                gs = GuacamoleService()
                gs.authenticate()
                gs.delete_connection(participant.vm.guacamole_connection_id)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f'Guac cleanup failed: {str(e)}')
            
        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            if getattr(participant.vm, 'proxmox_vm_id', None):
                ps = ProxmoxService()
                ps.delete_vm_completely(participant.vm.proxmox_vm_id)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f'Proxmox cleanup failed: {str(e)}')
            
        vm_id = participant.vm.id
        participant.vm = None
        participant.vm_status = 'stopped'
        participant.save()
        
        try:
            from apps.vms.models import VirtualMachine
            VirtualMachine.objects.filter(id=vm_id).delete()
        except Exception:
            pass

    @staticmethod
    def handle_participant_removal(participant):
        """Handle host removing a participant."""
        SessionLifecycleService._cleanup_participant_vm(participant)
        participant.status = 'removed'
        participant.save()

    @staticmethod
    def end_live_session(session):
        """End the entire session and cleanup all participants."""
        for participant in session.participants.filter(status__in=['joined', 'connected']):
            SessionLifecycleService.handle_participant_removal(participant)
            
        session.status = 'ended'
        session.save()
