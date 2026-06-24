"""
One-time migration: update icon field on original 5 templates from emoji to Lucide icon names.
Run with: python patch_icons.py
"""
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.models import VMTemplate

ICON_PATCHES = {
    'AutoCAD Workstation': 'Compass',
    'MATLAB Lab': 'BarChart2',
    'Programming Environment': 'Code2',
    'Graphic Design Studio': 'Palette',
    'Network Lab': 'Network',
}

for name, icon in ICON_PATCHES.items():
    updated = VMTemplate.objects.filter(name=name).update(icon=icon)
    print(f'  {"✓" if updated else "–"} {name} → {icon}')

print('\nDone. All template icons updated.')
