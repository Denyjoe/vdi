from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from apps.users.permissions import IsAdmin
from apps.sessions.models import RemoteSession, LiveSession, SessionParticipant
from apps.users.admin_services import log_admin_action
from apps.vms.services.pool_service import VMPoolService
from apps.notifications.services import notify
from apps.users.models import User
import base64

class AdminSessionStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    def get(self, request):
        # RemoteSession is dead code — it's only ever imported by an old
        # standalone test script (test_phase4.py), never by any real view,
        # so it has zero rows in production. Every actual live/hosted
        # session is a LiveSession, which is what this endpoint should
        # have been reading all along.
        total_sessions = LiveSession.objects.count()
        live_sessions = LiveSession.objects.filter(status='active').count()
        completed_sessions = LiveSession.objects.filter(status='ended').count()
        
        return Response({
            "success": True,
            "data": {
                "total_sessions": total_sessions,
                "live_sessions": live_sessions,
                "completed_sessions": completed_sessions
            }
        })

class AdminLiveSessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        sessions = LiveSession.objects.filter(status='active').select_related('host').order_by('-created_at')
        
        results = []
        for s in sessions:
            participant_count = 0
            try:
                participant_count = s.participants.count()
            except Exception:
                pass
            
            results.append({
                'id': s.id,
                'name': s.name,
                'host_name': f'{s.host.first_name} {s.host.last_name}' if s.host else 'Unknown',
                'host_email': s.host.email if s.host else '',
                'invite_code': s.invite_code,
                'participant_count': participant_count,
                'max_participants': getattr(s, 'max_participants', 0),
                'started_at': s.created_at.isoformat() if hasattr(s, 'created_at') and s.created_at else None,
                'session_type': getattr(s, 'session_type', 'workshop'),
                'restrictions': getattr(s, 'restrictions', {}),
                'network_locked': s.restrict_internet,
                'allowed_domains': s.allowed_domains,
            })
        
        return Response({
            'sessions': results,
            'total_active': len(results),
            'total_participants': sum(r['participant_count'] for r in results),
        })


class AdminSessionMonitorView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request, session_id):
        try:
            session = LiveSession.objects.get(id=session_id)
        except LiveSession.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        
        participants_data = []
        try:
            for p in session.participants.select_related('user', 'vm').all():
                guac_url = None
                if p.vm and hasattr(p.vm, 'guacamole_connection_id') and p.vm.guacamole_connection_id:
                    identifier = f"{p.vm.guacamole_connection_id}\0c\0postgresql"
                    encoded = base64.b64encode(identifier.encode()).decode()
                    guac_url = f"http://localhost:8080/guacamole/#/client/{encoded}"
                
                participants_data.append({
                    'id': p.id,
                    'user_id': p.user.id if p.user else None,
                    'user_name': f'{p.user.first_name} {p.user.last_name}' if p.user else 'Unknown',
                    'user_email': p.user.email if p.user else '',
                    'vm_status': getattr(p.vm, 'status', 'unknown') if p.vm else 'no_vm',
                    'ip_address': getattr(p.vm, 'ip_address', None) if p.vm else None,
                    'guacamole_url': guac_url,
                    'joined_at': p.joined_at.isoformat() if hasattr(p, 'joined_at') and p.joined_at else None,
                })
        except Exception as e:
            pass
        
        return Response({
            'session': {
                'id': session.id,
                'name': session.name,
                'host_name': f'{session.host.first_name} {session.host.last_name}' if session.host else 'Unknown',
                'invite_code': session.invite_code,
                'started_at': session.created_at.isoformat() if hasattr(session, 'created_at') and session.created_at else None,
                'restrictions': getattr(session, 'restrictions', {}),
            },
            'participants': participants_data,
        })


class AdminDisconnectParticipantView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request, session_id):
        participant_id = request.data.get('participant_id')
        
        try:
            participant = SessionParticipant.objects.get(id=participant_id)
            
            if participant.vm:
                pool = VMPoolService()
                try:
                    pool.release_vm(participant.vm)
                except Exception:
                    pass
            
            user_email = participant.user.email if participant.user else 'unknown'
            participant.delete()
            
            log_admin_action(request.user, 'session_ended', f'Force disconnected {user_email} from session')
            
            return Response({'success': True, 'message': 'Participant disconnected'})
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)


class AdminForceEndSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request, session_id):
        try:
            session = LiveSession.objects.get(id=session_id)
            
            stopped = 0
            try:
                pool = VMPoolService()
                for p in session.participants.all():
                    if p.vm:
                        try:
                            pool.release_vm(p.vm)
                            stopped += 1
                        except Exception:
                            pass
            except Exception:
                pass
            
            session.status = 'ended'
            session.save()
            
            log_admin_action(
                request.user, 
                'session_ended',
                f'Force ended session "{session.name}" (hosted by {session.host.email if session.host else "unknown"}). {stopped} VM(s) stopped.'
            )
            
            return Response({'success': True, 'message': f'Session ended. {stopped} VM(s) stopped.'})
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)


class AdminSendMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def post(self, request):
        user_id = request.data.get('user_id')
        message = request.data.get('message')
        
        try:
            user = User.objects.get(id=user_id)
            notify(user=user, title='Message from Admin', message=message, notification_type='direct_message')
            return Response({'success': True, 'message': 'Message sent'})
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)


class AdminToggleRecordingView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def put(self, request, session_id):
        enabled = request.data.get('enabled', False)
        try:
            session = LiveSession.objects.get(id=session_id)
            restrictions = getattr(session, 'restrictions', {}) or {}
            if not isinstance(restrictions, dict):
                restrictions = {}
            restrictions['session_recording'] = enabled
            session.restrictions = restrictions
            session.save()
            
            log_admin_action(request.user, 'session_ended', f'{"Enabled" if enabled else "Disabled"} recording for session "{session.name}"')
            return Response({'success': True, 'message': f'Recording {"enabled" if enabled else "disabled"}'})
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)
