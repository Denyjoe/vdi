import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.vms.models import VMTemplate

# Delete all except Standard Desktop and Zorin Desktop
templates_to_keep = ['Standard Desktop', 'Zorin Desktop']
for t in VMTemplate.objects.exclude(name__in=templates_to_keep):
    print('Deleting:', t.name)
    t.delete()

# Rename Standard Desktop to Ubuntu Desktop
standard = VMTemplate.objects.filter(name='Standard Desktop').first()
if standard:
    standard.name = 'Ubuntu Desktop'
    standard.storage_gb = 15
    standard.os = 'Ubuntu 22.04 LTS'
    standard.icon = 'Terminal'
    standard.description = (
        'A clean, traditional Linux '
        'desktop experience. Fast, '
        'lightweight, and reliable for '
        'browsing, documents, and '
        'coding.')
    standard.save()
    print('Updated:', standard.name, standard.storage_gb, 'GB')
else:
    # If already renamed to Ubuntu Desktop
    ubuntu = VMTemplate.objects.filter(name='Ubuntu Desktop').first()
    if ubuntu:
        ubuntu.storage_gb = 15
        ubuntu.os = 'Ubuntu 22.04 LTS'
        ubuntu.icon = 'Terminal'
        ubuntu.description = (
            'A clean, traditional Linux '
            'desktop experience. Fast, '
            'lightweight, and reliable for '
            'browsing, documents, and '
            'coding.')
        ubuntu.save()
        print('Already renamed. Updated:', ubuntu.name, ubuntu.storage_gb, 'GB')


# Give Zorin Desktop distinct icon
zorin = VMTemplate.objects.filter(name='Zorin Desktop').first()
if zorin:
    zorin.icon = 'AppWindow'
    zorin.save()
    print('Updated Zorin icon to:', zorin.icon)

print("--- FINAL TEMPLATES ---")
for t in VMTemplate.objects.all():
    print(t.name, '|', t.cpu_cores, 
        'vCPU |', t.ram_gb, 'GB RAM |', 
        t.storage_gb, 'GB storage |', 
        'icon:', getattr(t, 'icon', 'None'))
