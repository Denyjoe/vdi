import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.models import VMTemplate, VirtualMachine, Workspace
from apps.users.models import SystemConfig

Workspace.objects.all().delete()
VirtualMachine.objects.all().delete()
VMTemplate.objects.all().delete()

templates_data = [
    {
        'name': 'Basic Desktop',
        'template_type': 'desktop',
        'cpu_cores': 1, 'ram_gb': 2, 'storage_gb': 20,
        'os': 'Ubuntu 22.04 LTS',
        'description': 'Light desktop for browsing, documents, and basic coding',
        'software_list': ["Firefox", "LibreOffice", "Text Editor", "Terminal"],
        'icon': 'Monitor',
        'price_per_hour': 0, 'monthly_cap': 0,
        'is_real': True, 'proxmox_template_id': 9000
    },
    {
        'name': 'Standard Desktop',
        'template_type': 'desktop',
        'cpu_cores': 2, 'ram_gb': 4, 'storage_gb': 40,
        'os': 'Ubuntu 22.04 LTS',
        'description': 'Development workspace with pre-installed tools for programming and data analysis',
        'software_list': ["VS Code", "Python 3.11", "Node.js", "Git", "PostgreSQL", "Firefox", "LibreOffice"],
        'icon': 'Code',
        'price_per_hour': 0, 'monthly_cap': 0,
        'is_real': True, 'proxmox_template_id': 9000
    },
    {
        'name': 'Performance Desktop',
        'template_type': 'desktop',
        'cpu_cores': 4, 'ram_gb': 8, 'storage_gb': 60,
        'os': 'Ubuntu 22.04 LTS',
        'description': 'High-performance workspace for CAD, data science, and heavy applications',
        'software_list': ["VS Code", "Python 3.11", "MATLAB", "Docker", "Firefox"],
        'icon': 'Zap',
        'price_per_hour': 0, 'monthly_cap': 0,
        'is_real': False
    },
    {
        'name': 'Windows Desktop',
        'template_type': 'desktop',
        'cpu_cores': 4, 'ram_gb': 8, 'storage_gb': 60,
        'os': 'Windows 10 Pro',
        'description': 'Windows environment for AutoCAD, Office, and Windows-only applications',
        'software_list': ["AutoCAD", "Microsoft Office", "Visual Studio"],
        'icon': 'AppWindow',
        'price_per_hour': 0, 'monthly_cap': 0,
        'is_real': False
    },
    {
        'name': 'Basic Server',
        'template_type': 'server',
        'cpu_cores': 1, 'ram_gb': 1, 'storage_gb': 20,
        'os': 'Ubuntu 22.04 Server',
        'description': 'Lightweight Linux server for web hosting and development',
        'software_list': ["Python", "Node.js", "Nginx", "PostgreSQL", "Git"],
        'icon': 'Server',
        'price_per_hour': 0, 'monthly_cap': 0,
        'is_real': False
    },
    {
        'name': 'Standard Server',
        'template_type': 'server',
        'cpu_cores': 2, 'ram_gb': 4, 'storage_gb': 80,
        'os': 'Ubuntu 22.04 Server',
        'description': 'Production-ready server for apps, APIs, and databases',
        'software_list': ["Docker", "Python", "Node.js", "PostgreSQL", "Redis", "Nginx"],
        'icon': 'HardDrive',
        'price_per_hour': 0, 'monthly_cap': 0,
        'is_real': False
    },
]

for t in templates_data:
    VMTemplate.objects.create(**t)

print("VMTemplates seeded successfully!")

