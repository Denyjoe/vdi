from django.core.management.base import BaseCommand
from apps.users.models import User, Payment
from apps.sessions.models import LiveSession
from apps.vms.models import VMTemplate
from django.utils import timezone
from datetime import timedelta

class Command(BaseCommand):
    help = 'Seeds the database with initial Ospace commercial platform data'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("Clearing existing data..."))
        Payment.objects.all().delete()
        LiveSession.objects.all().delete()
        User.objects.exclude(is_superuser=True).delete()
        
        templates_data = [
          {
            "name": "AutoCAD Workstation",
            "description": "Professional CAD design environment",
            "cpu_cores": 4, "ram_gb": 8,
            "storage_gb": 60,
            "os": "Windows 10 Pro",
            "software_list": ["AutoCAD 2024", "AutoCAD LT"],
            "icon": "Compass",
            "is_available": True
          },
          {
            "name": "Programming Environment",
            "description": "Full-stack development workspace",
            "cpu_cores": 2, "ram_gb": 4,
            "storage_gb": 40,
            "os": "Ubuntu 22.04 LTS",
            "software_list": ["VS Code", "Python 3.11", "Node.js", "Git", "PostgreSQL"],
            "icon": "Code2",
            "is_available": True
          }
        ]

        for t in templates_data:
            VMTemplate.objects.get_or_create(
                name=t['name'],
                defaults=t
            )

        self.stdout.write(f'VM Templates: {VMTemplate.objects.count()}')

        self.stdout.write(self.style.SUCCESS("Adding Demo Users..."))
        password = "Ospace2026!"

        admin = User.objects.create_user(
            username='admin@ospace.io', email='admin@ospace.io',
            password=password, role='admin', first_name='Platform', last_name='Admin'
        )

        host = User.objects.create_user(
            username='host@ospace.io', email='host@ospace.io',
            password=password, role='user', first_name='Alex', last_name='Host',
            bio="Experienced AutoCAD trainer", country="Tanzania"
        )

        user1 = User.objects.create_user(
            username='user@ospace.io', email='user@ospace.io',
            password=password, role='user', first_name='Sam', last_name='User',
            country="Tanzania"
        )

        user2 = User.objects.create_user(
            username='user2@ospace.io', email='user2@ospace.io',
            password=password, role='user', first_name='Maria', last_name='User',
            country="Kenya"
        )

        self.stdout.write(self.style.SUCCESS("Adding Sample Live Session..."))
        vm_template = VMTemplate.objects.filter(name="AutoCAD Workstation").first()
        now = timezone.now()
        LiveSession.objects.create(
            name="AutoCAD Practical Workshop",
            host=host,
            session_type='workshop',
            required_vm_template=vm_template,
            is_public=False,
            max_participants=50,
            start_time=now + timedelta(days=1, hours=10),
            end_time=now + timedelta(days=1, hours=13),
            description="Learn to create professional floor plans using AutoCAD 2024"
        )

        self.stdout.write(self.style.SUCCESS("Seed data completed successfully!"))
