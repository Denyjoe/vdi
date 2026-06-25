from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.vms.models import VMTemplate
from apps.classes.models import Class, ClassEnrollment, CourseStream

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with initial users, VM templates, and a class'

    def handle(self, *args, **options):
        self.stdout.write('Starting seed...')

        # ── 1. Create Users ──────────────────────────────────────────────
        users_data = [
            {'email': 'admin@dit.ac.tz', 'role': 'admin', 'name': 'System Admin'},
            {'email': 'shija@dit.ac.tz', 'role': 'lecturer', 'name': 'Mr. Shija'},
            {'email': 'denis@dit.ac.tz', 'role': 'student', 'name': 'Denis Wilson', 'student_id': '230242498947'},
            {'email': 'student2@dit.ac.tz', 'role': 'student', 'name': 'Amina Hassan', 'student_id': '230242498948'},
            {'email': 'student3@dit.ac.tz', 'role': 'student', 'name': 'John Mbeki', 'student_id': '230242498949'},
        ]

        created_users = {}
        for user_data in users_data:
            email = user_data.pop('email')
            name = user_data.pop('name')
            parts = name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''

            user, created = User.objects.get_or_create(
                username=email,
                defaults={
                    'email': email,
                    'first_name': first_name,
                    'last_name': last_name,
                    'is_staff': user_data.get('role') == 'admin',
                    'is_superuser': user_data.get('role') == 'admin',
                    **user_data
                }
            )
            if created:
                user.set_password('Test1234!')
                user.save()
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created user {email}'))
            else:
                self.stdout.write(self.style.WARNING(f'  – User {email} already exists'))
            created_users[email] = user

        # ── 2. Create VM Templates ───────────────────────────────────────
        templates_data = [
            # Original 5
            {
                'name': 'AutoCAD Workstation',
                'cpu_cores': 4, 'ram_gb': 8, 'storage_gb': 60,
                'os': 'Windows 10 Pro',
                'software_list': ["AutoCAD 2024", "AutoCAD LT"],
                'description': 'Full AutoCAD suite for civil and mechanical engineering drawings.',
                'icon': 'Compass'
            },
            {
                'name': 'MATLAB Lab',
                'cpu_cores': 4, 'ram_gb': 16, 'storage_gb': 80,
                'os': 'Windows 10 Pro',
                'software_list': ["MATLAB R2023", "Simulink", "Signal Processing Toolbox"],
                'description': 'MATLAB environment for mathematical computing and simulation.',
                'icon': 'BarChart2'
            },
            {
                'name': 'Programming Environment',
                'cpu_cores': 2, 'ram_gb': 4, 'storage_gb': 40,
                'os': 'Ubuntu 22.04 LTS',
                'software_list': ["VS Code", "Python 3.11", "Node.js", "Git", "PostgreSQL"],
                'description': 'General-purpose development environment for programming courses.',
                'icon': 'Code2'
            },
            {
                'name': 'Graphic Design Studio',
                'cpu_cores': 4, 'ram_gb': 8, 'storage_gb': 80,
                'os': 'Windows 10 Pro',
                'software_list': ["Photoshop 2024", "Illustrator 2024", "Premiere Pro"],
                'description': 'Creative suite for graphic design and multimedia production.',
                'icon': 'Palette'
            },
            {
                'name': 'Network Lab',
                'cpu_cores': 2, 'ram_gb': 4, 'storage_gb': 40,
                'os': 'Ubuntu 22.04 LTS',
                'software_list': ["Cisco Packet Tracer", "Wireshark", "GNS3", "PuTTY"],
                'description': 'Networking tools for simulation and traffic analysis.',
                'icon': 'Network'
            },
            # 7 New Templates
            {
                'name': 'Cybersecurity Lab',
                'cpu_cores': 4, 'ram_gb': 8, 'storage_gb': 60,
                'os': 'Kali Linux 2024',
                'software_list': ["Metasploit", "Wireshark", "Burp Suite", "Nmap", "John the Ripper", "Aircrack-ng"],
                'description': 'Penetration testing and ethical hacking lab for cybersecurity courses.',
                'icon': 'Shield'
            },
            {
                'name': 'Civil Engineering Suite',
                'cpu_cores': 4, 'ram_gb': 16, 'storage_gb': 100,
                'os': 'Windows 10 Pro',
                'software_list': ["AutoCAD Civil 3D", "Revit 2024", "SAP2000", "ETABS"],
                'description': 'Structural and civil design tools for engineering students.',
                'icon': 'Building2'
            },
            {
                'name': 'Data Science Lab',
                'cpu_cores': 4, 'ram_gb': 16, 'storage_gb': 80,
                'os': 'Ubuntu 22.04 LTS',
                'software_list': ["Python 3.11", "Jupyter Lab", "TensorFlow", "PyTorch", "Pandas", "Scikit-learn", "R Studio"],
                'description': 'Machine learning and data analysis environment for data science courses.',
                'icon': 'BrainCircuit'
            },
            {
                'name': 'Mobile Development Studio',
                'cpu_cores': 4, 'ram_gb': 8, 'storage_gb': 60,
                'os': 'Ubuntu 22.04 LTS',
                'software_list': ["Android Studio", "Flutter SDK", "VS Code", "Firebase CLI", "Dart"],
                'description': 'Android and cross-platform mobile app development environment.',
                'icon': 'Smartphone'
            },
            {
                'name': 'Database Administration Lab',
                'cpu_cores': 2, 'ram_gb': 4, 'storage_gb': 60,
                'os': 'Ubuntu 22.04 LTS',
                'software_list': ["MySQL Workbench", "pgAdmin 4", "MongoDB Compass", "Redis", "DBeaver"],
                'description': 'Comprehensive database management and administration tools.',
                'icon': 'Database'
            },
            {
                'name': 'Video Production Suite',
                'cpu_cores': 8, 'ram_gb': 32, 'storage_gb': 200,
                'os': 'Windows 10 Pro',
                'software_list': ["DaVinci Resolve", "Adobe Premiere Pro", "After Effects", "Audacity"],
                'description': 'High-performance video editing and production workstation.',
                'icon': 'Film'
            },
            {
                'name': 'Web Development Studio',
                'cpu_cores': 2, 'ram_gb': 4, 'storage_gb': 40,
                'os': 'Ubuntu 22.04 LTS',
                'software_list': ["VS Code", "Node.js LTS", "React", "Docker", "Nginx", "Postman", "Git"],
                'description': 'Full-stack web development environment with modern tooling.',
                'icon': 'Globe'
            },
        ]

        for temp_data in templates_data:
            name = temp_data.pop('name')
            template, created = VMTemplate.objects.get_or_create(
                name=name,
                defaults=temp_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created template: {name}'))
            else:
                self.stdout.write(self.style.WARNING(f'  – Template exists: {name}'))

        total = VMTemplate.objects.count()
        self.stdout.write(self.style.SUCCESS(f'\nTotal VM templates in DB: {total}'))

        # ── 3. Create Class ──────────────────────────────────────────────
        lecturer = created_users.get('shija@dit.ac.tz')
        if lecturer:
            class_room, created = Class.objects.get_or_create(
                name='Computer Engineering Lab',
                defaults={
                    'lecturer': lecturer,
                    'description': 'Practical lab sessions for Computer Engineering students'
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created class: Computer Engineering Lab'))
            else:
                self.stdout.write(self.style.WARNING(f'  – Class already exists: Computer Engineering Lab'))

            # Enroll students
            student_emails = ['denis@dit.ac.tz', 'student2@dit.ac.tz', 'student3@dit.ac.tz']
            for email in student_emails:
                student = created_users.get(email)
                if student:
                    enrollment, created = ClassEnrollment.objects.get_or_create(
                        student=student,
                        class_room=class_room
                    )
                    if created:
                        self.stdout.write(self.style.SUCCESS(f'  ✓ Enrolled {email}'))
                    else:
                        self.stdout.write(self.style.WARNING(f'  – {email} already enrolled'))

        # ── 4. Seed Course Streams ───────────────────────────────────────
        self.stdout.write('\nSeeding DIT course streams...')
        streams_data = [
            # Computer Engineering
            {
                "code": "BENG22 COE-1",
                "name": "Computer Engineering Group 1",
                "department": "Computer Engineering",
                "year_of_study": 4,
            },
            {
                "code": "BENG22 COE-2",
                "name": "Computer Engineering Group 2",
                "department": "Computer Engineering",
                "year_of_study": 4,
            },
            {
                "code": "BENG21 COE-1",
                "name": "Computer Engineering Group 1",
                "department": "Computer Engineering",
                "year_of_study": 3,
            },
            {
                "code": "BENG21 COE-2",
                "name": "Computer Engineering Group 2",
                "department": "Computer Engineering",
                "year_of_study": 3,
            },
            # Civil Engineering
            {
                "code": "BENG22 CVE-1",
                "name": "Civil Engineering Group 1",
                "department": "Civil Engineering",
                "year_of_study": 4,
            },
            {
                "code": "BENG22 CVE-2",
                "name": "Civil Engineering Group 2",
                "department": "Civil Engineering",
                "year_of_study": 4,
            },
            # Electrical Engineering
            {
                "code": "BENG22 EEE-1",
                "name": "Electrical Engineering Group 1",
                "department": "Electrical Engineering",
                "year_of_study": 4,
            },
            # Business IT
            {
                "code": "BBIT22 BIT-1",
                "name": "Business IT Group 1",
                "department": "Business Information Technology",
                "year_of_study": 4,
            },
            {
                "code": "BBIT22 BIT-2",
                "name": "Business IT Group 2",
                "department": "Business Information Technology",
                "year_of_study": 4,
            },
        ]

        for s in streams_data:
            stream, created = CourseStream.objects.get_or_create(
                code=s['code'], defaults=s
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created stream: {stream}'))
            else:
                self.stdout.write(self.style.WARNING(f'  – Stream exists: {stream}'))

        # ── 5. Assign Denis's stream ──────────────────────────────────────
        try:
            denis = User.objects.get(email='denis@dit.ac.tz')
            coe2 = CourseStream.objects.get(code='BENG22 COE-2')
            denis.stream = coe2
            denis.department = 'Computer Engineering'
            denis.year_of_study = 4
            denis.save()
            self.stdout.write(self.style.SUCCESS(f'  ✓ Denis stream set to: {coe2}'))
        except User.DoesNotExist:
            self.stdout.write(self.style.WARNING('  – Denis user not found, skipping stream assignment.'))
        except CourseStream.DoesNotExist:
            self.stdout.write(self.style.WARNING('  – BENG22 COE-2 stream not found.'))

        self.stdout.write(self.style.SUCCESS('\nAll seeding complete!'))
