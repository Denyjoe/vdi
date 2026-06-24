from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.vms.models import VMTemplate
from apps.classes.models import Class, ClassEnrollment

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with initial users, VM templates, and a class'

    def handle(self, *args, **options):
        # 1. Create Users
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
            # Extract first_name and last_name from name
            parts = name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''

            user, created = User.objects.get_or_create(
                username=email, # Using email as username
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
                self.stdout.write(self.style.SUCCESS(f'Created user {email}'))
            else:
                self.stdout.write(self.style.WARNING(f'User {email} already exists'))
            created_users[email] = user

        # 2. Create VM Templates
        templates_data = [
            {
                'name': 'AutoCAD Workstation',
                'cpu_cores': 4, 'ram_gb': 8, 'storage_gb': 60,
                'os': 'Windows 10 Pro',
                'software_list': ["AutoCAD 2024", "AutoCAD LT"],
                'icon': '🏗️'
            },
            {
                'name': 'MATLAB Lab',
                'cpu_cores': 4, 'ram_gb': 16, 'storage_gb': 80,
                'os': 'Windows 10 Pro',
                'software_list': ["MATLAB R2023", "Simulink", "Signal Processing Toolbox"],
                'icon': '📊'
            },
            {
                'name': 'Programming Environment',
                'cpu_cores': 2, 'ram_gb': 4, 'storage_gb': 40,
                'os': 'Ubuntu 22.04 LTS',
                'software_list': ["VS Code", "Python 3.11", "Node.js", "Git", "PostgreSQL"],
                'icon': '💻'
            },
            {
                'name': 'Graphic Design Studio',
                'cpu_cores': 4, 'ram_gb': 8, 'storage_gb': 80,
                'os': 'Windows 10 Pro',
                'software_list': ["Photoshop 2024", "Illustrator 2024", "Premiere Pro"],
                'icon': '🎨'
            },
            {
                'name': 'Network Lab',
                'cpu_cores': 2, 'ram_gb': 4, 'storage_gb': 40,
                'os': 'Ubuntu 22.04 LTS',
                'software_list': ["Cisco Packet Tracer", "Wireshark", "GNS3", "PuTTY"],
                'icon': '🌐'
            }
        ]

        for temp_data in templates_data:
            name = temp_data.pop('name')
            template, created = VMTemplate.objects.get_or_create(
                name=name,
                defaults=temp_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created template {name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Template {name} already exists'))

        # 3. Create Class
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
                self.stdout.write(self.style.SUCCESS(f'Created class Computer Engineering Lab'))
            else:
                self.stdout.write(self.style.WARNING(f'Class Computer Engineering Lab already exists'))

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
                        self.stdout.write(self.style.SUCCESS(f'Enrolled {email} in Computer Engineering Lab'))
                    else:
                        self.stdout.write(self.style.WARNING(f'Student {email} already enrolled'))
        
        self.stdout.write(self.style.SUCCESS('Seeding complete!'))
