from django.core.management.base import BaseCommand
from apps.users.models import User, SubscriptionPlan, UserSubscription
from apps.classes.models import Group, GroupMembership
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
        GroupMembership.objects.all().delete()
        LiveSession.objects.all().delete()
        Group.objects.all().delete()
        User.objects.exclude(is_superuser=True).delete()
        # VMTemplate keep or create one
        if not VMTemplate.objects.filter(name="AutoCAD Workstation").exists():
            VMTemplate.objects.create(
                name="AutoCAD Workstation",
                description="High performance VM for AutoCAD",
                cpu_cores=4,
                ram_gb=8,
                storage_gb=50,
                os="Windows 10",
                is_available=True
            )

        self.stdout.write(self.style.SUCCESS("Adding Subscription Plans..."))
        free_plan = SubscriptionPlan.objects.create(
            name='free',
            display_name="Free",
            price_usd=0, price_tzs=0,
            compute_hours_per_month=5,
            max_workspaces=1,
            can_create_sessions=False,
            can_create_groups=False,
            features=[
                "5 compute hours/month",
                "Access 12+ VM templates",
                "Join public sessions",
                "Join groups with invite code",
                "Basic support"
            ]
        )

        starter_plan = SubscriptionPlan.objects.create(
            name='starter',
            display_name="Starter",
            price_usd=9, price_tzs=23000,
            compute_hours_per_month=20,
            max_workspaces=3,
            can_create_sessions=False,
            can_create_groups=True,
            features=[
                "20 compute hours/month",
                "Create unlimited groups",
                "Share materials and assignments",
                "3 persistent workspaces",
                "Priority support"
            ]
        )

        pro_plan = SubscriptionPlan.objects.create(
            name='pro',
            display_name="Pro",
            price_usd=19, price_tzs=49000,
            compute_hours_per_month=80,
            max_workspaces=10,
            can_create_sessions=True,
            can_create_groups=True,
            features=[
                "80 compute hours/month",
                "Create live sessions",
                "Up to 50 participants/session",
                "Session monitoring dashboard",
                "10 persistent workspaces",
                "Analytics and reports"
            ]
        )

        inst_plan = SubscriptionPlan.objects.create(
            name='institution',
            display_name="Institution",
            price_usd=99, price_tzs=255000,
            compute_hours_per_month=-1,
            max_workspaces=-1,
            can_create_sessions=True,
            can_create_groups=True,
            can_publish_templates=True,
            features=[
                "Unlimited compute hours",
                "Unlimited users",
                "Custom VM templates",
                "Bulk user management",
                "Dedicated support",
                "Full usage analytics"
            ]
        )

        self.stdout.write(self.style.SUCCESS("Adding Demo Users..."))
        password = "Admin2026!"
        
        admin = User.objects.create_user(
            username='admin@clouddesk.io', email='admin@clouddesk.io',
            password=password, role='admin', first_name='Platform', last_name='Admin'
        )
        
        instructor = User.objects.create_user(
            username='instructor@clouddesk.io', email='instructor@clouddesk.io',
            password=password, role='instructor', first_name='Alex', last_name='Instructor',
            bio="Experienced AutoCAD trainer", country="Tanzania"
        )
        UserSubscription.objects.create(user=instructor, plan=pro_plan)
        
        member1 = User.objects.create_user(
            username='member@clouddesk.io', email='member@clouddesk.io',
            password=password, role='member', first_name='Sam', last_name='Member',
            country="Tanzania"
        )
        UserSubscription.objects.create(user=member1, plan=free_plan)
        
        member2 = User.objects.create_user(
            username='member2@clouddesk.io', email='member2@clouddesk.io',
            password=password, role='member', first_name='Maria', last_name='Member',
            country="Kenya"
        )
        UserSubscription.objects.create(user=member2, plan=starter_plan)

        self.stdout.write(self.style.SUCCESS("Adding Sample Group..."))
        group = Group.objects.create(
            name="AutoCAD Fundamentals",
            created_by=instructor,
            group_type='public',
            description="Learn AutoCAD from scratch. Open to everyone.",
            tags=["engineering", "autocad", "design"]
        )

        self.stdout.write(self.style.SUCCESS("Adding Sample Live Session..."))
        vm_template = VMTemplate.objects.filter(name="AutoCAD Workstation").first()
        now = timezone.now()
        LiveSession.objects.create(
            name="AutoCAD Floor Plan Workshop",
            host=instructor,
            session_type='workshop',
            required_vm_template=vm_template,
            is_public=True,
            start_time=now + timedelta(days=1, hours=10),
            end_time=now + timedelta(days=1, hours=13),
            description="Learn to create professional floor plans using AutoCAD 2024"
        )

        self.stdout.write(self.style.SUCCESS("Seed data completed successfully!"))
