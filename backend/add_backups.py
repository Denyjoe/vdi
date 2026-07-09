import os

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/admin_views.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Append Backup endpoints
backup_views = '''

class BackupListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        import os
        from django.conf import settings
        
        backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        
        if not os.path.exists(backup_dir):
            return Response({'backups': []})
        
        files = []
        for f in os.listdir(backup_dir):
            if f.endswith('.sql'):
                path = os.path.join(backup_dir, f)
                files.append({
                    'filename': f,
                    'size_mb': round(os.path.getsize(path) / (1024*1024), 2),
                    'created_at': os.path.getctime(path),
                })
        
        files.sort(key=lambda x: x['created_at'], reverse=True)
        
        return Response({
            'backups': files
        })

class BackupDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request, filename):
        import os
        from django.http import FileResponse, Http404
        from django.conf import settings
        
        # Security: prevent path traversal
        if '..' in filename or '/' in filename or r'\\' in filename:
            raise Http404()
        
        backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        filepath = os.path.join(backup_dir, filename)
        
        if not os.path.exists(filepath):
            raise Http404()
        
        return FileResponse(open(filepath, 'rb'), as_attachment=True, filename=filename)
'''
if 'class BackupListView' not in content:
    with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/admin_views.py', 'a', encoding='utf-8') as f:
        f.write(backup_views)
    print("Added backup endpoints.")
else:
    print("Backup endpoints already exist.")

# Now wire in urls
with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/admin_urls.py', 'r', encoding='utf-8') as f:
    urls_content = f.read()

if 'backup/list/' not in urls_content:
    import_addition = 'from .admin_views import (\\n    BackupListView, BackupDownloadView,'
    urls_content = urls_content.replace('from .admin_views import (', import_addition)
    
    url_addition = '''    path('config/', SystemConfigView.as_view(), name='admin-config'),
    path('backup/list/', BackupListView.as_view(), name='admin-backup-list'),
    path('backup/download/<str:filename>/', BackupDownloadView.as_view(), name='admin-backup-download'),'''
    urls_content = urls_content.replace("path('config/', SystemConfigView.as_view(), name='admin-config'),", url_addition)
    
    with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/admin_urls.py', 'w', encoding='utf-8') as f:
        f.write(urls_content)
    print("Wired backup urls.")
