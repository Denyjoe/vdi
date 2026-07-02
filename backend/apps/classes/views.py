from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q, Value, CharField
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from .models import Group, GroupMembership
from .serializers import GroupSerializer, GroupMembershipSerializer
from apps.users.permissions import CanCreateGroups

class GroupListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = GroupSerializer

    def get_queryset(self):
        user = self.request.user
        return Group.objects.filter(memberships__user=user, is_active=True).annotate(
            member_count=Count('memberships')
        ).distinct()
        
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        # Custom logic to add user_role_in_group if needed, 
        # though it's easier to just fetch it dynamically or annotate
        data = []
        for group in queryset:
            serializer = self.get_serializer(group)
            group_data = serializer.data
            membership = GroupMembership.objects.filter(group=group, user=request.user).first()
            group_data['user_role_in_group'] = membership.role_in_group if membership else None
            data.append(group_data)
        
        return Response({
            "success": True,
            "data": data
        })

class PublicGroupsView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = GroupSerializer

    def get_queryset(self):
        queryset = Group.objects.filter(is_active=True, group_type='public').annotate(
            member_count=Count('memberships')
        ).order_by('-member_count')
        
        search = self.request.query_params.get('search', None)
        tags = self.request.query_params.get('tags', None)
        
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(description__icontains=search))
        if tags:
            tag_list = tags.split(',')
            # Basic tag filtering via JSON contains - SQLite might not support full JSON ops, 
            # so we'll do a simple loop for safety in dev, but exact match here
            for tag in tag_list:
                queryset = queryset.filter(tags__contains=tag.strip())
                
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data
        })

class GroupCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, CanCreateGroups]

    def post(self, request):
        serializer = GroupSerializer(data=request.data)
        if serializer.is_valid():
            group = serializer.save(created_by=request.user)
            # Auto-add creator as owner
            GroupMembership.objects.create(group=group, user=request.user, role_in_group='owner')
            
            # Re-serialize to get invite codes and counts
            group.member_count = 1
            response_data = GroupSerializer(group).data
            response_data['user_role_in_group'] = 'owner'
            
            return Response({
                "success": True,
                "data": response_data
            }, status=status.HTTP_201_CREATED)
            
        return Response({
            "success": False,
            "message": "Invalid data",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class GroupDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        group = get_object_or_404(Group, pk=pk, is_active=True)
        membership = GroupMembership.objects.filter(group=group, user=request.user).first()
        
        if not membership and group.group_type != 'public':
            return Response({"success": False, "message": "Not a member"}, status=status.HTTP_403_FORBIDDEN)
            
        group.member_count = group.memberships.count()
        serializer = GroupSerializer(group)
        data = serializer.data
        data['user_role_in_group'] = membership.role_in_group if membership else None
        
        # Additional lists like members, resources
        data['members'] = GroupMembershipSerializer(group.memberships.all()[:10], many=True).data
        
        return Response({
            "success": True,
            "data": data
        })

class JoinGroupByCodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = request.data.get('invite_code')
        if not code:
            return Response({"success": False, "message": "Invite code required"}, status=status.HTTP_400_BAD_REQUEST)
            
        group = Group.objects.filter(invite_code=code.upper(), is_active=True).first()
        if not group:
            return Response({"success": False, "message": "Invalid invite code"}, status=status.HTTP_404_NOT_FOUND)
            
        if GroupMembership.objects.filter(group=group, user=request.user).exists():
            return Response({"success": False, "message": "Already a member"}, status=status.HTTP_400_BAD_REQUEST)
            
        if group.memberships.count() >= group.max_members:
            return Response({"success": False, "message": "Group is full"}, status=status.HTTP_400_BAD_REQUEST)
            
        GroupMembership.objects.create(group=group, user=request.user, role_in_group='member')
        
        group.member_count = group.memberships.count()
        serializer = GroupSerializer(group)
        data = serializer.data
        data['user_role_in_group'] = 'member'
        
        return Response({
            "success": True,
            "data": data
        })

class LeaveGroupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        membership = GroupMembership.objects.filter(group=group, user=request.user).first()
        
        if not membership:
            return Response({"success": False, "message": "Not a member"}, status=status.HTTP_400_BAD_REQUEST)
            
        if membership.role_in_group == 'owner':
            return Response({"success": False, "message": "Owner cannot leave group, must delete or transfer ownership"}, status=status.HTTP_400_BAD_REQUEST)
            
        membership.delete()
        return Response({"success": True})

class GroupMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        group = get_object_or_404(Group, pk=pk, is_active=True)
        if not GroupMembership.objects.filter(group=group, user=request.user).exists():
            return Response({"success": False, "message": "Not a member"}, status=status.HTTP_403_FORBIDDEN)
            
        memberships = group.memberships.all()
        serializer = GroupMembershipSerializer(memberships, many=True)
        return Response({
            "success": True,
            "data": serializer.data
        })

class UpdateGroupView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = GroupSerializer
    
    def get_queryset(self):
        return Group.objects.filter(memberships__user=self.request.user, memberships__role_in_group='owner')
        
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response({"success": True, "data": serializer.data})

class DeleteGroupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        
        if request.user.role != 'admin' and not GroupMembership.objects.filter(group=group, user=request.user, role_in_group='owner').exists():
            return Response({"success": False, "message": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
            
        group.is_active = False
        group.save()
        return Response({"success": True})
