from django.core.management.base import BaseCommand
from apps.users.models import User, SubscriptionPlan, UserSubscription
from apps.sessions.models import LiveSession
from apps.vms.models import VMTemplate
from django.utils import timezone
from datetime import timedelta

class Command(BaseCommand):
    help = 'Seeds the database with initial CloudDesk commercial platform data'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("Clearing existing data..."))
        UserSubscription.objects.all().delete()
        SubscriptionPlan.objects.all().delete()
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

        self.stdout.write(self.style.SUCCESS("Adding Subscription Plans..."))
        free_plan = SubscriptionPlan.objects.create(
            name='free',
            display_name="Free",
            price_usd=0, price_tzs=0,
            compute_hours_per_month=5,
            can_host_sessions=False,
            max_session_participants=0,
            features=[
                "5 workspace hours/month",
                "Join any session for free",
                "Access 12+ VM templates",
                "Personal cloud workspace"
            ]
        )

        personal_host_plan = SubscriptionPlan.objects.create(
            name='personal_host',
            display_name="Personal Host",
            price_usd=9, price_tzs=23000,
            compute_hours_per_month=20,
            can_host_sessions=True,
            max_session_participants=10,
            features=[
                "Host sessions up to 10 participants",
                "20 workspace hours/month",
                "Invite code + link generation",
                "Real-time participant monitoring",
                "Session analytics",
                "All VM templates available"
            ]
        )

        pro_host_plan = SubscriptionPlan.objects.create(
            name='pro_host',
            display_name="Pro Host",
            price_usd=19, price_tzs=49000,
            compute_hours_per_month=80,
            can_host_sessions=True,
            max_session_participants=50,
            features=[
                "Host sessions up to 50 participants",
                "80 workspace hours/month",
                "Exam mode with restrictions",
                "Full analytics dashboard",
                "Priority VM provisioning",
                "Custom session branding"
            ]
        )

        inst_plan = SubscriptionPlan.objects.create(
            name='institution',
            display_name="Institution",
            price_usd=99, price_tzs=255000,
            compute_hours_per_month=-1,
            can_host_sessions=True,
            max_session_participants=200,
            features=[
                "Host sessions up to 200 participants",
                "Unlimited workspace hours",
                "Custom VM templates",
                "Dedicated support",
                "Usage analytics export",
                "Multiple host accounts"
            ]
        )

        self.stdout.write(self.style.SUCCESS("Adding Demo Users..."))
        password = "CloudDesk2026!"
        
        admin = User.objects.create_user(
            username='admin@clouddesk.io', email='admin@clouddesk.io',
            password=password, role='admin', first_name='Platform', last_name='Admin'
        )
        
        host = User.objects.create_user(
            username='host@clouddesk.io', email='host@clouddesk.io',
            password=password, role='user', first_name='Alex', last_name='Host',
            is_host=True, host_plan='pro_host',
            bio="Experienced AutoCAD trainer", country="Tanzania"
        )
        UserSubscription.objects.create(user=host, plan=pro_host_plan)
        
        user1 = User.objects.create_user(
            username='user@clouddesk.io', email='user@clouddesk.io',
            password=password, role='user', first_name='Sam', last_name='User',
            is_host=False, host_plan='none',
            country="Tanzania"
        )
        UserSubscription.objects.create(user=user1, plan=free_plan)
        
        user2 = User.objects.create_user(
            username='user2@clouddesk.io', email='user2@clouddesk.io',
            password=password, role='user', first_name='Maria', last_name='User',
            is_host=False, host_plan='none',
            country="Kenya"
        )
        UserSubscription.objects.create(user=user2, plan=free_plan)

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
