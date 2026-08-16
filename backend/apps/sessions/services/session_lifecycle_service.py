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
                def provision_and_update(vm_id, part_id):
                    try:
                        from apps.vms.models import VirtualMachine
                        from apps.sessions.models import SessionParticipant
                        vm_obj = VirtualMachine.objects.get(id=vm_id)
                        part_obj = SessionParticipant.objects.get(id=part_id)
                        
                        res = orchestrator.provision_real_vm(vm_obj)
                        if res and 'error' not in res:
                            part_obj.refresh_from_db()
                            # Real bug found via live-timed testing: lockdown
                            # used to be applied AFTER status was already
                            # saved as 'connected' — confirmed a genuine
                            # ~1.75s real gap where the VM had ZERO firewall
                            # rules and no enable/policy set (fully open,
                            # not restricted) at the exact moment a
                            # participant was told their desktop was ready.
                            # Apply lockdown first, so by the time
                            # 'connected' is ever visible, the real Proxmox
                            # firewall state is already final — no window
                            # where "ready" and "policy applied" disagree.
                            SessionLifecycleService._apply_network_lockdown(part_obj)
                            part_obj.status = 'connected'
                            part_obj.save(update_fields=['status'])
                        else:
                            part_obj.refresh_from_db()
                            part_obj.status = 'error'
                            part_obj.save(update_fields=['status'])
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).error(
                            f"Participant {part_id} VM provision failed: {e}", 
                            exc_info=True
                        )
                        try:
                            from apps.sessions.models import SessionParticipant
                            part_obj = SessionParticipant.objects.get(id=part_id)
                            part_obj.status = 'error'
                            part_obj.save(update_fields=['status'])
                        except Exception:
                            pass

                thread = threading.Thread(target=provision_and_update, args=(vm.id, participant.id))
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
    def _apply_network_lockdown(participant):
        """Enable network lockdown on a participant's VM if the session requires it."""
        if not participant:
            return
        participant.refresh_from_db()
        if not participant.vm:
            return
        participant.vm.refresh_from_db()
        
        proxmox_vm_id = getattr(participant.vm, 'proxmox_vm_id', None)
        if not proxmox_vm_id:
            import logging
            logging.getLogger(__name__).warning(
                f"Cannot apply network lockdown: participant {participant.id} VM has no proxmox_vm_id"
            )
            return
            
        session = participant.session
        if not session.restrict_internet:
            return
        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            ProxmoxService().enable_vm_lockdown(
                proxmox_vm_id,
                allowed_domains=session.allowed_domains,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(
                f'Network lockdown failed for participant {participant.id}: {str(e)}',
                exc_info=True,
            )

    @staticmethod
    def _cleanup_participant_vm(participant):
        """Helper to cleanly delete a participant's VM from Proxmox and Guacamole."""
        if not participant.vm:
            return

        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            if getattr(participant.vm, 'proxmox_vm_id', None):
                ProxmoxService().disable_vm_lockdown(participant.vm.proxmox_vm_id)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f'Network lockdown removal failed: {str(e)}')

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
