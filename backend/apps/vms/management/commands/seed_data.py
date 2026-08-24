"""
Management command to seed the database with initial data.

Seeds: Users, VM Templates, Departments, Programmes, CourseStreams,
a sample Class, enrollments, and a sample PracticalSession.

Usage:
    python manage.py seed_data
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.vms.models import VMTemplate
from apps.classes.models import (
    Class, ClassEnrollment, CourseStream, Department, Programme,
)
from apps.sessions.models import PracticalSession, StudentPracticalAccess
from datetime import date, time, timedelta
from django.utils import timezone
import datetime

User = get_user_model()


class Command(BaseCommand):
    """Seed the database with DIT academic structure, users, and VM templates."""

    help = 'Seeds the database with initial users, VM templates, academic structure, and sample data'

    def handle(self, *args, **options):
        """Execute the seeding process in order: users → templates → academic structure → classes."""
        self.stdout.write('Starting seed...')

        created_users = self._seed_users()
        self._seed_vm_templates()
        self._seed_departments()
        programmes = self._seed_programmes()
        self._seed_course_streams(programmes)
        self._seed_class(created_users)
        self._assign_user_profiles(created_users)
        self._seed_practical_session(created_users)
        self._seed_system_settings()

        self.stdout.write(self.style.SUCCESS('\nAll seeding complete!'))

    def _seed_system_settings(self):
        """Seed default system settings."""
        self.stdout.write('\n── Seeding System Settings ──')
        from apps.users.models import SystemSetting
        
        default_settings = [
            {'key': 'max_vms_per_student', 'value': '1', 'description': 'Maximum number of VMs a student can have running at once'},
            {'key': 'max_session_hours', 'value': '8', 'description': 'Maximum session duration in hours before auto-disconnect'},
            {'key': 'vm_provisioning_timeout', 'value': '320', 'description': 'VM provisioning timeout in seconds'},
            {'key': 'allow_student_registration', 'value': 'true', 'description': 'Allow new student self-registration'},
            {'key': 'require_enrollment_approval', 'value': 'true', 'description': 'Require lecturer approval for class enrollment requests'},
            {'key': 'current_academic_year', 'value': '2025/2026', 'description': 'Current academic year displayed across the system'},
            {'key': 'current_semester', 'value': '1', 'description': 'Current semester (1 or 2)'},
            {'key': 'institution_name', 'value': 'Dar es Salaam Institute of Technology', 'description': 'Institution name shown in system'},
            {'key': 'institution_short_name', 'value': 'DIT', 'description': 'Short name / acronym'},
            {'key': 'max_file_upload_mb', 'value': '100', 'description': 'Maximum file upload size in MB'},
            {'key': 'session_timeout_minutes', 'value': '480', 'description': 'Idle session timeout in minutes'},
            {'key': 'maintenance_mode', 'value': 'false', 'description': 'Put system in maintenance mode. Only admins can login.'},
            {'key': 'system_announcement', 'value': '', 'description': 'System-wide announcement shown to all users on login'},
        ]

        for s in default_settings:
            SystemConfig.set(s['key'], s['value'])
            self.stdout.write(self.style.SUCCESS(f"  ✓ Set setting: {s['key']} = {s['value']}"))
    def _seed_users(self):
        """
        Create initial user accounts for testing.

        Returns:
            dict: Mapping of email → User instance.
        """
        self.stdout.write('\n── Seeding Users ──')

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
                self.stdout.write(self.style.WARNING(f'  - User {email} already exists'))
            created_users[email] = user

        return created_users

    def _seed_vm_templates(self):
        """Create VM template catalog for students to choose from."""
        self.stdout.write('\n── Seeding VM Templates ──')

        # Delete old templates first
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

        for temp_data in templates_data:
            name = temp_data.pop('name')
            template, created = VMTemplate.objects.get_or_create(
                name=name,
                defaults=temp_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created template: {name}'))
            else:
                self.stdout.write(self.style.WARNING(f'  - Template exists: {name}'))

        total = VMTemplate.objects.count()
        self.stdout.write(self.style.SUCCESS(f'  Total VM templates in DB: {total}'))

    def _seed_departments(self):
        """Create DIT academic departments."""
        self.stdout.write('\n── Seeding Departments ──')

        departments_data = [
            {"code": "CS", "name": "Computer Studies",
             "description": "Department covering IT, Computer Engineering, Communication Systems, and Multimedia Technology"},
            {"code": "ETE", "name": "Electronics and Telecommunications Engineering",
             "description": "Department covering electronics and telecommunications systems"},
            {"code": "EE", "name": "Electrical Engineering",
             "description": "Department covering electrical systems and power"},
            {"code": "ME", "name": "Mechanical Engineering",
             "description": "Department covering mechanical systems and design"},
            {"code": "CE", "name": "Civil Engineering",
             "description": "Department covering structural and civil works"},
            {"code": "SLT", "name": "Science and Laboratory Technology",
             "description": "Department covering laboratory sciences"},
            {"code": "GS", "name": "General Studies",
             "description": "Foundation and general education department"},
        ]

        for d in departments_data:
            dept, created = Department.objects.get_or_create(code=d['code'], defaults=d)
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created department: {d["code"]}: {d["name"]}'))
            else:
                self.stdout.write(self.style.WARNING(f'  - Department exists: {d["code"]}'))

    def _seed_programmes(self):
        self.stdout.write('\n── Seeding Programmes ──')

        cs = Department.objects.get(code='CS')
        ete = Department.objects.get(code='ETE')
        ee = Department.objects.get(code='EE')
        me = Department.objects.get(code='ME')
        ce = Department.objects.get(code='CE')
        slt = Department.objects.get(code='SLT')

        programmes_data = [
            # ── Civil Engineering ──
            {'department': ce, 'code': 'DIP-CVE', 'name': 'Ordinary Diploma in Civil Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ce, 'code': 'DIP-MNE', 'name': 'Ordinary Diploma in Mining Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ce, 'code': 'BENG-CVE', 'name': 'Bachelor of Civil Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': ce, 'code': 'BENG-MNE', 'name': 'Bachelor of Mining Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': ce, 'code': 'BENG-OGE', 'name': 'Bachelor of Oil and Gas Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},

            # ── Computer Studies ──
            {'department': cs, 'code': 'DIP-COE', 'name': 'Ordinary Diploma in Computer Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': cs, 'code': 'DIP-IT', 'name': 'Ordinary Diploma in Information Technology', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': cs, 'code': 'DIP-MFT', 'name': 'Ordinary Diploma in Multimedia and Film Technology', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': cs, 'code': 'BENG-COE', 'name': 'Bachelor of Computer Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': cs, 'code': 'BIT', 'name': 'Bachelor of Information Technology', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': cs, 'code': 'MSC-CC', 'name': 'Master in Computing and Communications', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},
            {'department': cs, 'code': 'MSC-CS', 'name': 'Master in Cyber Security', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},
            {'department': cs, 'code': 'MSC-IS', 'name': 'Master in Information Systems', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},

            # ── Electrical Engineering ──
            {'department': ee, 'code': 'DIP-EE', 'name': 'Ordinary Diploma in Electrical Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ee, 'code': 'DIP-BME', 'name': 'Ordinary Diploma in Biomedical Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ee, 'code': 'DIP-RE', 'name': 'Ordinary Diploma in Renewable Energy', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ee, 'code': 'DIP-ERE', 'name': 'Ordinary Diploma in Electrical and Renewable Energy', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ee, 'code': 'BENG-EE', 'name': 'Bachelor of Electrical Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': ee, 'code': 'BENG-BME', 'name': 'Bachelor of Biomedical Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},

            # ── Electronics & Telecom ──
            {'department': ete, 'code': 'DIP-ETE', 'name': 'Ordinary Diploma in Electronics and Telecommunications', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ete, 'code': 'DIP-CST', 'name': 'Ordinary Diploma in Communication System Technology', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ete, 'code': 'BENG-ETE', 'name': 'Bachelor of Engineering in Electronics and Telecommunications', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': ete, 'code': 'MSC-TSN', 'name': 'Master in Telecommunications Systems and Networks', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},

            # ── Mechanical Engineering ──
            {'department': me, 'code': 'DIP-ME', 'name': 'Ordinary Diploma in Mechanical Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': me, 'code': 'DIP-IAE', 'name': 'Ordinary Diploma in Industrial and Automotive Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': me, 'code': 'BENG-ME', 'name': 'Bachelor of Mechanical Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': me, 'code': 'MSC-MM', 'name': 'Master in Maintenance Management', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},
            {'department': me, 'code': 'MSC-SEE', 'name': 'Master in Sustainable Energy Engineering', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},

            # ── Science & Lab Tech ──
            {'department': slt, 'code': 'DIP-LT', 'name': 'Ordinary Diploma in Laboratory Technology', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': slt, 'code': 'DIP-FS', 'name': 'Ordinary Diploma in Food Science', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': slt, 'code': 'DIP-BT', 'name': 'Ordinary Diploma in Biotechnology', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': slt, 'code': 'BTECH-LS', 'name': 'Bachelor of Technology in Laboratory Sciences', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
        ]

        programmes = {}
        for p in programmes_data:
            dept = p.pop('department')
            prog, created = Programme.objects.get_or_create(
                code=p['code'],
                defaults={**p, 'department': dept}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created programme: {p["code"]}: {p["name"]}'))
            else:
                for attr, value in p.items():
                    setattr(prog, attr, value)
                prog.department = dept
                prog.save()
                self.stdout.write(self.style.WARNING(f'  - Programme exists/updated: {p["code"]}'))
            programmes[prog.code] = prog

        return programmes

    def _seed_course_streams(self, programmes):
        self.stdout.write('\n── Seeding Course Streams ──')

        cs = Department.objects.get(code='CS')
        ete = Department.objects.get(code='ETE')
        ee = Department.objects.get(code='EE')
        me = Department.objects.get(code='ME')
        ce = Department.objects.get(code='CE')
        slt = Department.objects.get(code='SLT')

        streams_data = [
            # ── COMPUTER STUDIES ──
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG22 COE-1', 'name': 'Bachelor of Computer Engineering Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG22 COE-2', 'name': 'Bachelor of Computer Engineering Year 2 Group 2', 'year_of_study': 2, 'group_number': 2},
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG23 COE-1', 'name': 'Bachelor of Computer Engineering Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG23 COE-2', 'name': 'Bachelor of Computer Engineering Year 3 Group 2', 'year_of_study': 3, 'group_number': 2},
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG24 COE-1', 'name': 'Bachelor of Computer Engineering Year 4 Group 1', 'year_of_study': 4, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG24 COE-2', 'name': 'Bachelor of Computer Engineering Year 4 Group 2', 'year_of_study': 4, 'group_number': 2},
            {'dept': cs, 'prog': programmes.get('BIT'), 'code': 'BIT22 IT-1', 'name': 'Bachelor of Information Technology Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('BIT'), 'code': 'BIT23 IT-1', 'name': 'Bachelor of Information Technology Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('BIT'), 'code': 'BIT24 IT-1', 'name': 'Bachelor of Information Technology Year 4 Group 1', 'year_of_study': 4, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-IT'), 'code': 'ODIT1 IT-1', 'name': 'Ordinary Diploma IT Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-IT'), 'code': 'ODIT2 IT-1', 'name': 'Ordinary Diploma IT Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-IT'), 'code': 'ODIT3 IT-1', 'name': 'Ordinary Diploma IT Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-COE'), 'code': 'ODCS1 CS-1', 'name': 'Ordinary Diploma Computer Science Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-COE'), 'code': 'ODCS2 CS-1', 'name': 'Ordinary Diploma Computer Science Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-COE'), 'code': 'ODCS3 CS-1', 'name': 'Ordinary Diploma Computer Science Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-CST'), 'code': 'ODCST1 CST-1', 'name': 'Ordinary Diploma Communication System Technology Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},

            # ── ELECTRONICS & TELECOM ──
            {'dept': ete, 'prog': programmes.get('BENG-ETE'), 'code': 'BENG22 ETE-1', 'name': 'Bachelor of Engineering Electronics & Telecom Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': ete, 'prog': programmes.get('BENG-ETE'), 'code': 'BENG23 ETE-1', 'name': 'Bachelor of Engineering Electronics & Telecom Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': ete, 'prog': programmes.get('DIP-ETE'), 'code': 'ODET1 ETE-1', 'name': 'Ordinary Diploma Electronics & Telecom Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},

            # ── ELECTRICAL ENGINEERING ──
            {'dept': ee, 'prog': programmes.get('BENG-EE'), 'code': 'BENG22 EE-1', 'name': 'Bachelor of Electrical Engineering Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': ee, 'prog': programmes.get('BENG-EE'), 'code': 'BENG23 EE-1', 'name': 'Bachelor of Electrical Engineering Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': ee, 'prog': programmes.get('DIP-EE'), 'code': 'ODEE1 EE-1', 'name': 'Ordinary Diploma Electrical Engineering Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},

            # ── MECHANICAL ENGINEERING ──
            {'dept': me, 'prog': programmes.get('BENG-ME'), 'code': 'BENG22 ME-1', 'name': 'Bachelor of Mechanical Engineering Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': me, 'prog': programmes.get('BENG-ME'), 'code': 'BENG23 ME-1', 'name': 'Bachelor of Mechanical Engineering Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': me, 'prog': programmes.get('DIP-ME'), 'code': 'ODME1 ME-1', 'name': 'Ordinary Diploma Mechanical Engineering Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},

            # ── CIVIL ENGINEERING ──
            {'dept': ce, 'prog': programmes.get('BENG-CVE'), 'code': 'BENG22 CVE-1', 'name': 'Bachelor of Civil Engineering Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': ce, 'prog': programmes.get('BENG-CVE'), 'code': 'BENG23 CVE-1', 'name': 'Bachelor of Civil Engineering Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': ce, 'prog': programmes.get('DIP-CVE'), 'code': 'ODCE1 CVE-1', 'name': 'Ordinary Diploma Civil Engineering Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},

            # ── SCIENCE & LAB TECH ──
            {'dept': slt, 'prog': programmes.get('BTECH-LS'), 'code': 'BTECH22 SLT-1', 'name': 'Bachelor of Technology Laboratory Sciences Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': slt, 'prog': programmes.get('DIP-LT'), 'code': 'ODSLT1 SLT-1', 'name': 'Ordinary Diploma Science & Laboratory Technology Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},
        ]

        for s in streams_data:
            dept = s.pop('dept')
            prog = s.pop('prog')
            stream, created = CourseStream.objects.get_or_create(
                code=s['code'],
                defaults={**s, 'department': dept, 'programme': prog}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created stream: {s["code"]}'))
            else:
                stream.programme = prog
                stream.save()
                self.stdout.write(self.style.WARNING(f'  - Stream exists/updated: {s["code"]}'))

    def _seed_class(self, created_users):
        """
        Create a sample class and enroll students.

        Args:
            created_users: dict mapping email → User instance.
        """
        self.stdout.write('\n── Seeding Class & Enrollments ──')

        lecturer = created_users.get('shija@dit.ac.tz')
        admin_user = created_users.get('admin@dit.ac.tz')
        if not lecturer:
            self.stdout.write(self.style.WARNING('  - Lecturer not found, skipping class creation.'))
            return

        cs = Department.objects.get(code='CS')
        bcoe = Programme.objects.filter(code='BENG-COE').first()

        class_room, created = Class.objects.get_or_create(
            name='Computer Engineering Lab',
            defaults={
                'lecturer': lecturer,
                'created_by': admin_user,
                'class_type': 'official',
                'description': 'Practical lab sessions for Computer Engineering students',
                'department': cs,
                'programme': bcoe,
                'year_of_study': 4,
                'academic_year': '2025/2026',
                'semester': 1,
            }
        )

        if created:
            # Assign streams to the class
            coe_streams = CourseStream.objects.filter(
                code__in=['BENG24 COE-1', 'BENG24 COE-2']
            )
            class_room.streams.set(coe_streams)
            self.stdout.write(self.style.SUCCESS('  ✓ Created class: Computer Engineering Lab'))
        else:
            # Update existing class to have correct type and creator
            class_room.class_type = 'official'
            class_room.created_by = admin_user
            class_room.save()
            self.stdout.write(self.style.WARNING('  - Class already exists: Computer Engineering Lab (updated type)'))

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
                    self.stdout.write(self.style.WARNING(f'  - {email} already enrolled'))

    def _assign_user_profiles(self, created_users):
        """
        Assign department, programme, stream, and year to seed users.

        Args:
            created_users: dict mapping email → User instance.
        """
        self.stdout.write('\n── Assigning User Profiles ──')

        # Denis → CS, BCOE, BENG24 COE-2, Year 4
        try:
            denis = created_users.get('denis@dit.ac.tz')
            if denis:
                cs_dept = Department.objects.get(code='CS')
                bcoe = Programme.objects.get(code='BENG-COE')
                beng24_coe2 = CourseStream.objects.get(code='BENG24 COE-2')
                denis.department = cs_dept
                denis.programme = bcoe
                denis.stream = beng24_coe2
                denis.year_of_study = 4
                denis.save()
                self.stdout.write(self.style.SUCCESS(
                    f'  ✓ Denis → {cs_dept.code}/{bcoe.code}/{beng24_coe2.code}/Y4'
                ))
        except (Department.DoesNotExist, Programme.DoesNotExist, CourseStream.DoesNotExist) as e:
            self.stdout.write(self.style.WARNING(f'  - Could not assign Denis profile: {e}'))

        # Mr. Shija → CS department
        try:
            shija = created_users.get('shija@dit.ac.tz')
            if shija:
                cs_dept = Department.objects.get(code='CS')
                bcoe = Programme.objects.get(code='BENG-COE')
                shija.department = cs_dept
                shija.programme = bcoe
                shija.save()
                self.stdout.write(self.style.SUCCESS(f'  ✓ Mr. Shija → {cs_dept.code}/{bcoe.code}'))
        except Department.DoesNotExist:
            self.stdout.write(self.style.WARNING('  - CS department not found.'))
        # student2 → Amina Hassan
        try:
            student2 = created_users.get('student2@dit.ac.tz')
            if student2:
                cs_dept = Department.objects.get(code='CS')
                bcoe = Programme.objects.get(code='BENG-COE')
                beng24_coe2 = CourseStream.objects.get(code='BENG24 COE-2')
                student2.department = cs_dept
                student2.programme = bcoe
                student2.stream = beng24_coe2
                student2.year_of_study = 4
                student2.save()
                self.stdout.write(self.style.SUCCESS(f'  ✓ student2 → {cs_dept.code}/{bcoe.code}/{beng24_coe2.code}/Y4'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  - Could not assign student2: {e}'))

        # student3 → John Mbeki
        try:
            student3 = created_users.get('student3@dit.ac.tz')
            if student3:
                cs_dept = Department.objects.get(code='CS')
                bcoe = Programme.objects.get(code='BENG-COE')
                beng24_coe1 = CourseStream.objects.get(code='BENG24 COE-1')
                student3.department = cs_dept
                student3.programme = bcoe
                student3.stream = beng24_coe1
                student3.year_of_study = 4
                student3.save()
                self.stdout.write(self.style.SUCCESS(f'  ✓ student3 → {cs_dept.code}/{bcoe.code}/{beng24_coe1.code}/Y4'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  - Could not assign student3: {e}'))


    def _seed_practical_session(self, created_users):
        """
        Create a sample practical session for testing.

        Args:
            created_users: dict mapping email → User instance.
        """
        self.stdout.write('\n── Seeding Practical Session ──')

        lecturer = created_users.get('shija@dit.ac.tz')
        if not lecturer:
            self.stdout.write(self.style.WARNING('  - Lecturer not found, skipping.'))
            return

        class_room = Class.objects.filter(name='Computer Engineering Lab').first()
        if not class_room:
            self.stdout.write(self.style.WARNING('  - Class not found, skipping.'))
            return

        autocad_template = VMTemplate.objects.filter(name='AutoCAD Workstation').first()

        tomorrow = timezone.now() + timedelta(days=1)
        start_time = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
        end_time = tomorrow.replace(hour=12, minute=0, second=0, microsecond=0)
        submission_deadline = tomorrow.replace(hour=12, minute=30, second=0, microsecond=0)

        session, created = PracticalSession.objects.get_or_create(
            name='CAD Drawing Lab 1',
            class_room=class_room,
            defaults={
                'session_type': 'lab',
                'submission_type': 'both',
                'lecturer': lecturer,
                'required_vm_template': autocad_template,
                'start_time': start_time,
                'end_time': end_time,
                'submission_deadline': submission_deadline,
                'status': PracticalSession.Status.SCHEDULED,
                'instructions': 'Complete Drawing Sheet 1 using AutoCAD. Save as PDF before submitting.',
                'max_concurrent_vms': 30,
                'auto_terminate': True,
            }
        )

        if created:
            # Auto-create access entries for enrolled students
            enrollments = ClassEnrollment.objects.filter(class_room=class_room)
            access_records = [
                StudentPracticalAccess(
                    practical_session=session,
                    student=enrollment.student
                )
                for enrollment in enrollments
            ]
            StudentPracticalAccess.objects.bulk_create(access_records, ignore_conflicts=True)
            self.stdout.write(self.style.SUCCESS(
                f'  ✓ Created practical session: {session.name} ({enrollments.count()} students)'
            ))
        else:
            self.stdout.write(self.style.WARNING(f'  - Practical session exists: {session.name}'))
