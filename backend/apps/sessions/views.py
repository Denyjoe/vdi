from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from .models import LiveSession, SessionParticipant
from .serializers import LiveSessionSerializer, SessionParticipantSerializer

class LiveSessionListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        hosted = LiveSession.objects.filter(host=user).annotate(
            participant_count=Count('participants')
        ).order_by('-start_time')
        
        joined = LiveSession.objects.filter(participants__user=user).annotate(
            participant_count=Count('participants')
        ).order_by('-start_time')
        
        return Response({
            "success": True,
            "data": {
                "my_hosted": LiveSessionSerializer(hosted, many=True).data,
                "joined": LiveSessionSerializer(joined, many=True).data
            }
        })

class PublicSessionsView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = LiveSessionSerializer

    def get_queryset(self):
        queryset = LiveSession.objects.filter(
            is_public=True,
            status__in=['scheduled', 'active']
        ).annotate(participant_count=Count('participants')).order_by('start_time')
        
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(description__icontains=search))
            
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data
        })

class PayAndStartSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        from apps.users.models import SystemConfig, Payment
        from apps.sessions.models import LiveSession
        from apps.vms.models import VMTemplate
        from django.utils import timezone
        from datetime import timedelta
        import random, string, decimal
        
        hours = decimal.Decimal(str(request.data.get('hours', 1)))
        
        if hours <= 0 or hours > 24:
            return Response({
                'success': False,
                'message': 'Please select between 0.5 and 24 hours.'
            }, status=400)
        
        rate = decimal.Decimal(SystemConfig.get('session_hosting_rate_tzs', '5000'))
        total_price = hours * rate
        
        phone = request.data.get('phone_number')
        provider = request.data.get('provider')
        session_name = request.data.get('name', f"{request.user.first_name}'s Session")
        template_id = request.data.get('vm_template')
        max_participants = request.data.get('max_participants', 10)
        restrictions = request.data.get('restrictions', {})
        restrict_internet = bool(request.data.get('restrict_internet', False))
        allowed_domains = request.data.get('allowed_domains', [])
        if not isinstance(allowed_domains, list):
            allowed_domains = []

        valid_session_types = dict(LiveSession.SESSION_TYPE_CHOICES)
        session_type = request.data.get('session_type', 'workshop')
        if session_type not in valid_session_types:
            session_type = 'workshop'
        
        try:
            template = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response({'success': False, 'message': 'Invalid template'}, status=400)
        
        # SANDBOX payment — instant success.
        import uuid
        transaction_id = f'CD-{str(uuid.uuid4())[:8].upper()}'
        try:
            Payment.objects.create(
                user=request.user,
                payment_type='session_hosting',
                amount_tzs=total_price,
                currency='TZS',
                provider=provider,
                phone_number=phone,
                status='completed',
                transaction_id=transaction_id,
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'FAILED to create payment record: {str(e)}', exc_info=True)
            return Response({
                'success': False,
                'message': 'Payment could not be processed. Please try again.'
            }, status=500)

        invite_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        
        now = timezone.now()
        end_at = now + timedelta(hours=float(hours))
        
        session = LiveSession.objects.create(
            host=request.user,
            name=session_name,
            session_type=session_type,
            required_vm_template=template,
            max_participants=max_participants,
            restrictions=restrictions,
            restrict_internet=restrict_internet,
            allowed_domains=allowed_domains,
            invite_code=invite_code,
            status='active',
            hours_purchased=hours,
            amount_paid_tzs=total_price,
            scheduled_end_at=end_at,
            start_time=now,
            end_time=end_at
        )
        
        from apps.users.admin_services import log_admin_action
        try:
            log_admin_action(
                request.user, 
                'config_changed',
                f'{request.user.email} started a {hours}hr paid session (TZS {total_price})'
            )
        except Exception:
            pass
        
        return Response({
            'success': True,
            'data': {
                'id': session.id,
                'invite_code': invite_code,
                'scheduled_end_at': end_at.isoformat(),
                'hours_purchased': float(hours),
                'amount_paid_tzs': float(total_price),
            }
        })

class JoinSessionByCodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = request.data.get('invite_code')
        password = request.data.get('password')
        
        if not code:
            return Response({"success": False, "message": "Invite code required"}, status=status.HTTP_400_BAD_REQUEST)
            
        session = LiveSession.objects.filter(invite_code=code.upper()).first()
        if not session:
            return Response({"success": False, "message": "Invalid invite code"}, status=status.HTTP_404_NOT_FOUND)
            
        if session.status not in ['scheduled', 'active']:
            return Response({"success": False, "message": "Session is not available to join"}, status=status.HTTP_400_BAD_REQUEST)
            
        if session.password and session.password != password:
            if not password:
                return Response({"success": False, "requires_password": True, "message": "This session requires a password"}, status=status.HTTP_401_UNAUTHORIZED)
            return Response({"success": False, "message": "Incorrect password"}, status=status.HTTP_401_UNAUTHORIZED)
            
        participant, created = SessionParticipant.objects.get_or_create(session=session, user=request.user)

        from apps.sessions.services.session_lifecycle_service import SessionLifecycleService
        if participant.vm and participant.vm.status in ('error', 'deleted'):
            # Existing VM reference is dead (crashed/removed) - clear it so a fresh one gets provisioned.
            participant.vm = None
            participant.save(update_fields=['vm'])
        if not participant.vm:
            SessionLifecycleService.handle_participant_join(participant)
        
        from apps.notifications.services import notify
        notify(
            user=request.user,
            title='Session Joined',
            message=f'Joined session "{session.name}"',
            notification_type='session_invite',
            link=f'/session/{session.id}'
        )
        
        session.participant_count = session.participants.count()
        return Response({
            "success": True,
            "data": {
                "session": LiveSessionSerializer(session).data,
                "participant": SessionParticipantSerializer(participant).data
            }
        })
class LiveSessionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        session = get_object_or_404(LiveSession, pk=pk)
        
        is_host = session.host == request.user
        participant = SessionParticipant.objects.filter(session=session, user=request.user).first()
        
        if not is_host and not participant and not session.is_public:
            return Response({"success": False, "message": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        # Auto-end check — mirrors SessionMonitorView's fallback so a
        # session genuinely ends on time even if the host doesn't have
        # their monitor page open. Any active session has at least one
        # participant polling this endpoint, so checking it here too means
        # auto-end no longer depends on the host specifically being present.
        from django.utils import timezone
        if session.status == 'active' and session.scheduled_end_at and timezone.now() >= session.scheduled_end_at:
            from apps.sessions.services.session_lifecycle_service import SessionLifecycleService
            SessionLifecycleService.end_live_session(session)
            session.refresh_from_db()

        session.participant_count = session.participants.count()
        data = LiveSessionSerializer(session).data
        data['participants'] = SessionParticipantSerializer(session.participants.all()[:50], many=True).data
        
        return Response({
            "success": True,
            "data": data
        })

class StartSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        session = get_object_or_404(LiveSession, pk=pk)
        if session.host != request.user:
            return Response({"success": False, "message": "Only host can start session"}, status=status.HTTP_403_FORBIDDEN)
            
        session.status = 'active'
        session.save()
        return Response({"success": True})

class EndSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        session = get_object_or_404(LiveSession, pk=pk)
        if session.host != request.user:
            return Response({"success": False, "message": "Only host can end session"}, status=status.HTTP_403_FORBIDDEN)
            
        from apps.sessions.services.session_lifecycle_service import SessionLifecycleService
        SessionLifecycleService.end_live_session(session)
        return Response({"success": True})

class SessionMonitorView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        session = get_object_or_404(LiveSession, pk=pk)
        if session.host != request.user:
            return Response({"success": False, "message": "Only host can monitor session"}, status=status.HTTP_403_FORBIDDEN)
            
        # Auto-end check — scheduled_end_at is the single source of truth,
        # set once at session creation. It's also the exact field the UI
        # countdown timer reads, so checking anything else (e.g.
        # recalculating from start_time + duration_hours) can drift out of
        # sync and end a session before the countdown participants are
        # watching reaches zero.
        from django.utils import timezone
        if session.status == 'active' and session.scheduled_end_at and timezone.now() >= session.scheduled_end_at:
            from apps.sessions.services.session_lifecycle_service import SessionLifecycleService
            SessionLifecycleService.end_live_session(session)
            session.refresh_from_db()
            
        participants = session.participants.all()
        return Response({
            "success": True,
            "data": {
                "session": LiveSessionSerializer(session).data,
                "participants": SessionParticipantSerializer(participants, many=True).data,
                "summary": {
                    "total_joined": participants.count(),
                    "active_vms": participants.filter(vm_status='running').count() if hasattr(SessionParticipant, 'vm_status') else 0,
                    "waiting": participants.filter(vm_status='waiting').count() if hasattr(SessionParticipant, 'vm_status') else 0
                }
            }
        })

class RemoveParticipantView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, user_id):
        session = get_object_or_404(LiveSession, pk=pk)
        if session.host != request.user:
            return Response({"success": False, "message": "Only host can remove participants"}, status=status.HTTP_403_FORBIDDEN)
            
        from apps.sessions.services.session_lifecycle_service import SessionLifecycleService
        
        participant = get_object_or_404(SessionParticipant, session=session, user_id=user_id)
        SessionLifecycleService.handle_participant_removal(participant)
        
        return Response({"success": True})

class LeaveSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        session = get_object_or_404(LiveSession, pk=pk)
        
        from apps.sessions.services.session_lifecycle_service import SessionLifecycleService
        participant = SessionParticipant.objects.filter(session=session, user=request.user).first()
        
        if participant:
            SessionLifecycleService.handle_participant_disconnect(participant)
            participant.delete()
            
        return Response({"success": True})

class DisconnectSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        # A participant disconnecting from a live session
        session = get_object_or_404(LiveSession, pk=pk)
        
        from apps.sessions.services.session_lifecycle_service import SessionLifecycleService
        participant = SessionParticipant.objects.filter(session=session, user=request.user).first()
        
        if participant:
            SessionLifecycleService.handle_participant_disconnect(participant)
            
        return Response({"success": True})

class HostControlParticipantView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk, participant_id):
        from apps.sessions.models import LiveSession, SessionParticipant
        
        try:
            session = LiveSession.objects.get(id=pk)
        except LiveSession.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        
        # CRITICAL SECURITY CHECK
        if session.host_id != request.user.id:
            return Response({
                'success': False,
                'message': 'Only the session host can control participant sessions.'
            }, status=403)
        
        try:
            participant = SessionParticipant.objects.get(id=participant_id, session=session)
        except SessionParticipant.DoesNotExist:
            return Response({'error': 'Participant not found'}, status=404)
        
        if not participant.vm or not participant.vm.guacamole_connection_id:
            return Response({
                'success': False,
                'message': 'Participant has no active connection.'
            }, status=400)
        
        from apps.vms.services.guacamole_service import GuacamoleService
        gs = GuacamoleService()
        gs.authenticate()
        
        # Generate a direct connection URL for the host.
        #
        # Background: Guacamole's sharingCredentials API (the "sharing profile" approach) requires
        # a live WebSocket *tunnel* UUID, which only exists in the participant's browser session —
        # the backend has no access to it. Instead, we give the host a direct connection URL to
        # the SAME Guacamole connection the participant is on. This is fully supported: each
        # connection allows up to 5 simultaneous sessions (max-connections=5), and all concurrent
        # sessions on the same connection share the same live desktop in full read-write mode.
        try:
            control_url = gs.get_connection_url(participant.vm.guacamole_connection_id)
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Failed to generate control URL: {str(e)}'
            }, status=500)
        
        from apps.users.admin_services import log_admin_action
        try:
            log_admin_action(
                request.user, 
                'config_changed',
                f'{request.user.email} took control of {participant.user.email}' + "'s session"
            )
        except Exception:
            pass
            
        participant.is_being_controlled = True
        participant.save(update_fields=['is_being_controlled'])
        
        return Response({
            'success': True,
            'control_url': control_url
        })

class HostReleaseControlView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk, participant_id):
        from apps.sessions.models import LiveSession, SessionParticipant
        
        try:
            session = LiveSession.objects.get(id=pk)
        except LiveSession.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
            
        if session.host_id != request.user.id:
            return Response({'error': 'Unauthorized'}, status=403)
            
        try:
            participant = SessionParticipant.objects.get(id=participant_id, session=session)
            participant.is_being_controlled = False
            participant.save(update_fields=['is_being_controlled'])
        except SessionParticipant.DoesNotExist:
            pass

        return Response({'success': True})

class BroadcastMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            session = LiveSession.objects.get(id=pk)
        except LiveSession.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        if session.host_id != request.user.id:
            return Response({
                'success': False,
                'message': 'Only the host can broadcast to this session.'
            }, status=403)

        message_text = request.data.get('message', '').strip()
        if not message_text:
            return Response({
                'success': False,
                'message': 'Message cannot be empty'
            }, status=400)

        from apps.notifications.services import notify

        sent_count = 0
        for participant in session.participants.filter(status__in=['joined', 'connected']):
            try:
                notify(
                    user=participant.user,
                    title=f'Message from {request.user.first_name}',
                    message=message_text,
                    notification_type='system',
                )
                sent_count += 1
            except Exception:
                pass

        return Response({
            'success': True,
            'message': f'Sent to {sent_count} participant(s)'
        })

class PauseAllParticipantsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            session = LiveSession.objects.get(id=pk)
        except LiveSession.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        if session.host_id != request.user.id:
            return Response({
                'success': False,
                'message': 'Only the host can pause this session.'
            }, status=403)

        paused_count = 0
        for participant in session.participants.filter(
            status__in=['joined', 'connected'],
            is_being_controlled=False,
        ):
            participant.is_being_controlled = True
            participant.save(update_fields=['is_being_controlled'])
            paused_count += 1

        return Response({
            'success': True,
            'message': f'Paused {paused_count} participant(s)'
        })

class ResumeAllParticipantsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            session = LiveSession.objects.get(id=pk)
        except LiveSession.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        if session.host_id != request.user.id:
            return Response({
                'success': False,
                'message': 'Only the host can resume this session.'
            }, status=403)

        resumed_count = 0
        for participant in session.participants.filter(is_being_controlled=True):
            participant.is_being_controlled = False
            participant.save(update_fields=['is_being_controlled'])
            resumed_count += 1

        return Response({
            'success': True,
            'message': f'Resumed {resumed_count} participant(s)'
        })

class ExtendSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from apps.users.models import SystemConfig, Payment
        from django.utils import timezone
        from datetime import timedelta
        import decimal
        import uuid

        try:
            session = LiveSession.objects.get(id=pk)
        except LiveSession.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        if session.host_id != request.user.id:
            return Response({
                'success': False,
                'message': 'Only the host can extend this session.'
            }, status=403)

        try:
            extra_hours = decimal.Decimal(str(request.data.get('hours', 1)))
        except (decimal.InvalidOperation, TypeError, ValueError):
            return Response({'success': False, 'message': 'Invalid hours value'}, status=400)

        if extra_hours <= 0 or extra_hours > 24:
            return Response({
                'success': False,
                'message': 'Please select between 0.5 and 24 hours.'
            }, status=400)

        rate = decimal.Decimal(SystemConfig.get('session_hosting_rate_tzs', '5000'))
        extra_price = extra_hours * rate

        phone = request.data.get('phone_number')
        provider = request.data.get('provider')

        # SANDBOX payment — instant success, same pattern as the real
        # billing checkout flow.
        # Deliberately NOT wrapped in a swallow-everything try/except: a
        # payment that silently fails to save must not silently extend
        # the session anyway.
        transaction_id = f'EXT-{str(uuid.uuid4())[:8].upper()}'
        Payment.objects.create(
            user=request.user,
            payment_type='session_extend',
            amount_tzs=extra_price,
            currency='TZS',
            provider=provider,
            phone_number=phone,
            status='completed',
            transaction_id=transaction_id,
        )

        base_time = session.scheduled_end_at or timezone.now()
        session.scheduled_end_at = base_time + timedelta(hours=float(extra_hours))
        session.hours_purchased = (session.hours_purchased or decimal.Decimal('0')) + extra_hours
        session.amount_paid_tzs = (session.amount_paid_tzs or decimal.Decimal('0')) + extra_price
        session.save()

        return Response({
            'success': True,
            'message': f'Extended by {extra_hours} hour(s)',
            'new_scheduled_end_at': session.scheduled_end_at.isoformat()
        })
