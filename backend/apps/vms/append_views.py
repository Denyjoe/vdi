with open('pool_views.py', 'a', encoding='utf-8') as f:
    f.write('''

class AdminTemplateCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def post(self, request):
        from apps.vms.models import VMTemplate
        
        data = request.data
        
        template = VMTemplate.objects.create(
            name=data.get('name'),
            template_type=data.get('template_type', 'desktop'),
            os=data.get('os'),
            icon=data.get('icon', 'Monitor'),
            cpu_cores=data.get('cpu_cores'),
            ram_gb=data.get('ram_gb'),
            storage_gb=data.get('storage_gb'),
            price_per_hour=data.get('price_per_hour', 0),
            monthly_cap=data.get('monthly_cap', 0),
            software_list=data.get('software_list', []),
            description=data.get('description', ''),
            is_available=data.get('is_available', True),
            is_real=False,  # Not linked to Proxmox yet
        )
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'template_created',
            f'Created template "{template.name}"')
        
        return Response({
            'success': True,
            'id': template.id,
            'message': 'Template created. Link it to Proxmox from the table to make it available for launch.'
        })

class AdminTemplateUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def put(self, request, template_id):
        from apps.vms.models import VMTemplate
        
        try:
            t = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
            
        data = request.data
        
        if 'name' in data: t.name = data['name']
        if 'template_type' in data: t.template_type = data['template_type']
        if 'os' in data: t.os = data['os']
        if 'icon' in data: t.icon = data['icon']
        if 'cpu_cores' in data: t.cpu_cores = data['cpu_cores']
        if 'ram_gb' in data: t.ram_gb = data['ram_gb']
        if 'storage_gb' in data: t.storage_gb = data['storage_gb']
        if 'price_per_hour' in data: t.price_per_hour = data['price_per_hour']
        if 'monthly_cap' in data: t.monthly_cap = data['monthly_cap']
        if 'software_list' in data: t.software_list = data['software_list']
        if 'description' in data: t.description = data['description']
        if 'is_available' in data: t.is_available = data['is_available']
        
        t.save()
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'template_updated',
            f'Updated template "{t.name}"')
            
        return Response({
            'success': True,
            'message': 'Template updated successfully.'
        })

class AdminTemplateDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def delete(self, request, template_id):
        from apps.vms.models import VMTemplate, Workspace
        
        try:
            t = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        
        active_workspaces = (
            Workspace.objects.filter(vm_template=t)
            .exclude(status='deleted').count()
        )
        
        if active_workspaces > 0:
            return Response({
                'success': False,
                'message': f'Cannot delete — {active_workspaces} workspace(s) use this template'
            }, status=400)
        
        name = t.name
        t.delete()
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'template_deleted',
            f'Deleted template "{name}"')
        
        return Response({
            'success': True,
            'message': 'Template deleted'
        })
''')
