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
            "name": "MATLAB Lab",
            "description": "Mathematical computing environment",
            "cpu_cores": 4, "ram_gb": 16,
            "storage_gb": 80,
            "os": "Windows 10 Pro",
            "software_list": ["MATLAB R2023", "Simulink", "Signal Processing Toolbox"],
            "icon": "BarChart2",
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
          },
          {
            "name": "Graphic Design Studio",
            "description": "Creative design environment",
            "cpu_cores": 4, "ram_gb": 8,
            "storage_gb": 80,
            "os": "Windows 10 Pro",
            "software_list": ["Photoshop 2024", "Illustrator 2024", "Premiere Pro"],
            "icon": "Palette",
            "is_available": True
          },
          {
            "name": "Network Lab",
            "description": "Network engineering environment",
            "cpu_cores": 2, "ram_gb": 4,
            "storage_gb": 40,
            "os": "Ubuntu 22.04 LTS",
            "software_list": ["Cisco Packet Tracer", "Wireshark", "GNS3", "PuTTY"],
            "icon": "Network",
            "is_available": True
          },
          {
            "name": "Cybersecurity Lab",
            "description": "Penetration testing and security",
            "cpu_cores": 4, "ram_gb": 8,
            "storage_gb": 60,
            "os": "Kali Linux 2024",
            "software_list": ["Metasploit", "Wireshark", "Burp Suite", "Nmap", "John the Ripper", "Aircrack-ng"],
            "icon": "Shield",
            "is_available": True
          },
          {
            "name": "Civil Engineering Suite",
            "description": "Structural and civil engineering tools",
            "cpu_cores": 4, "ram_gb": 16,
            "storage_gb": 100,
            "os": "Windows 10 Pro",
            "software_list": ["AutoCAD Civil 3D", "Revit 2024", "SAP2000", "ETABS"],
            "icon": "Building",
            "is_available": True
          },
          {
            "name": "Data Science Lab",
            "description": "Machine learning and data analysis",
            "cpu_cores": 4, "ram_gb": 16,
            "storage_gb": 80,
            "os": "Ubuntu 22.04 LTS",
            "software_list": ["Python 3.11", "Jupyter Lab", "TensorFlow", "PyTorch", "Pandas", "Scikit-learn", "R Studio"],
            "icon": "BrainCircuit",
            "is_available": True
          },
          {
            "name": "Mobile Development Studio",
            "description": "Android and Flutter development",
            "cpu_cores": 4, "ram_gb": 8,
            "storage_gb": 60,
            "os": "Ubuntu 22.04 LTS",
            "software_list": ["Android Studio", "Flutter SDK", "VS Code", "Firebase CLI", "Dart"],
            "icon": "Smartphone",
            "is_available": True
          },
          {
            "name": "Database Administration Lab",
            "description": "Database management environment",
            "cpu_cores": 2, "ram_gb": 4,
            "storage_gb": 60,
            "os": "Ubuntu 22.04 LTS",
            "software_list": ["MySQL Workbench", "pgAdmin 4", "MongoDB Compass", "Redis", "DBeaver"],
            "icon": "Database",
            "is_available": True
          },
          {
            "name": "Video Production Suite",
            "description": "Professional video editing",
            "cpu_cores": 8, "ram_gb": 32,
            "storage_gb": 200,
            "os": "Windows 10 Pro",
            "software_list": ["DaVinci Resolve", "Adobe Premiere Pro", "After Effects", "Audacity"],
            "icon": "Video",
            "is_available": True
          },
          {
            "name": "Web Development Studio",
            "description": "Full-stack web development",
            "cpu_cores": 2, "ram_gb": 4,
            "storage_gb": 40,
            "os": "Ubuntu 22.04 LTS",
            "software_list": ["VS Code", "Node.js LTS", "React", "Docker", "Nginx", "Postman", "Git"],
            "icon": "Globe",
            "is_available": True
          },
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
