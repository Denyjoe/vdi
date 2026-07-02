from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from .models import LiveSession, SessionParticipant
from .serializers import LiveSessionSerializer, SessionParticipantSerializer
from apps.users.permissions import CanHostSessions

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

class LiveSessionCreateView(APIView):
    permission_classes = [CanHostSessions]

    def post(self, request):
        serializer = LiveSessionSerializer(data=request.data)
        if serializer.is_valid():
            max_allowed = request.user.subscription.plan.max_session_participants
            if serializer.validated_data.get('max_participants', 50) > max_allowed:
                raise ValidationError(f"Your plan allows up to {max_allowed} participants. Upgrade to host more.")
            
            session = serializer.save(host=request.user)
            session.participant_count = 0
            
            return Response({
                "success": True,
                "session_id": session.id,
                "invite_code": session.invite_code,
                "invite_link": f"https://clouddesk.io/join/{session.invite_code}",
                "qr_code_url": None,
                "host_link": f"https://clouddesk.io/host/{session.invite_code}",
                "session_details": LiveSessionSerializer(session).data
            }, status=status.HTTP_201_CREATED)
            
        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

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
            
        session.status = 'ended'
        session.save()
        return Response({"success": True})

class SessionMonitorView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        session = get_object_or_404(LiveSession, pk=pk)
        if session.host != request.user:
            return Response({"success": False, "message": "Only host can monitor session"}, status=status.HTTP_403_FORBIDDEN)
            
        participants = session.participants.all()
        return Response({
            "success": True,
            "data": SessionParticipantSerializer(participants, many=True).data
        })

class RemoveParticipantView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, user_id):
        session = get_object_or_404(LiveSession, pk=pk)
        if session.host != request.user:
            return Response({"success": False, "message": "Only host can remove participants"}, status=status.HTTP_403_FORBIDDEN)
            
        participant = get_object_or_404(SessionParticipant, session=session, user_id=user_id)
        participant.status = 'removed'
        participant.save()
        
        return Response({"success": True})
