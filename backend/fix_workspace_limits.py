import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/vms/workspace_views.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix WorkspaceCreateView
create_block = '''                sub = request.user.subscription
                max_w = getattr(sub.plan, 'max_workspaces', -1)
                current_w = Workspace.objects.filter(owner=request.user).exclude(status='deleted').count()
                
                if max_w != -1 and current_w >= max_w:
                    return Response({
                        "success": False,
                        "message": f"Workspace limit reached for {sub.plan.display_name} plan"
                    }, status=status.HTTP_403_FORBIDDEN)'''
                    
new_create_block = '''                from apps.users.models import SystemConfig
                max_per_user = int(SystemConfig.get('max_vms_per_user', '3'))
                
                sub = request.user.subscription
                max_w = getattr(sub.plan, 'max_workspaces', -1)
                current_w = Workspace.objects.filter(owner=request.user).exclude(status='deleted').count()
                
                if current_w >= max_per_user:
                    return Response({
                        "success": False,
                        "message": f"You have reached the platform maximum of {max_per_user} workspace(s). Delete an existing workspace to create a new one."
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                if max_w != -1 and current_w >= max_w:
                    return Response({
                        "success": False,
                        "message": f"Workspace limit reached for {sub.plan.display_name} plan"
                    }, status=status.HTTP_403_FORBIDDEN)'''
content = content.replace(create_block, new_create_block)

# Fix WorkspaceLaunchView
launch_block = '''        try:
            sub = request.user.subscription
            if sub.hours_remaining <= 0:
                return Response({
                    "success": False,
                    "message": "No compute hours remaining. Upgrade your plan to continue."
                }, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass
            
        if workspace.status == 'deleted':
            return Response({"success": False, "message": "Workspace is deleted"}, status=status.HTTP_400_BAD_REQUEST)'''

new_launch_block = '''        from apps.users.models import SystemConfig
        from apps.vms.models import VirtualMachine
        
        max_concurrent = int(SystemConfig.get('max_concurrent_vms', '10'))
        active_vms = VirtualMachine.objects.filter(status='running').count()
        if active_vms >= max_concurrent:
            return Response({
                "success": False,
                "message": "Platform is at maximum capacity. Please try again shortly."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            sub = request.user.subscription
            if sub.hours_remaining <= 0:
                return Response({
                    "success": False,
                    "message": "No compute hours remaining. Upgrade your plan to continue."
                }, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass
            
        if workspace.status == 'deleted':
            return Response({"success": False, "message": "Workspace is deleted"}, status=status.HTTP_400_BAD_REQUEST)'''
content = content.replace(launch_block, new_launch_block)

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/vms/workspace_views.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated workspace limits enforcement.")
