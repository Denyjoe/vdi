import os

with open('apps/vms/management/commands/seed_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
if 'import datetime' not in content:
    content = content.replace('from datetime import date, time', 'from datetime import date, time, timedelta\nfrom django.utils import timezone\nimport datetime')

# Update Shija profile
shija_old = '''        # Mr. Shija → CS department
        try:
            shija = created_users.get('shija@dit.ac.tz')
            if shija:
                cs_dept = Department.objects.get(code='CS')
                shija.department = cs_dept
                shija.save()
                self.stdout.write(self.style.SUCCESS(f'  ✓ Mr. Shija → {cs_dept.code}'))
        except Department.DoesNotExist:
            self.stdout.write(self.style.WARNING('  – CS department not found.'))'''

shija_new = '''        # Mr. Shija → CS department
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
            self.stdout.write(self.style.WARNING('  – CS department not found.'))'''
content = content.replace(shija_old, shija_new)

# Add student2 and student3 profiles
student23 = '''
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
            self.stdout.write(self.style.WARNING(f'  – Could not assign student2: {e}'))

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
            self.stdout.write(self.style.WARNING(f'  – Could not assign student3: {e}'))
'''
content = content.replace("self.stdout.write(self.style.WARNING('  – CS department not found.'))", "self.stdout.write(self.style.WARNING('  – CS department not found.'))" + student23)

# Update practical session
session_old = '''        session, created = PracticalSession.objects.get_or_create(
            name='CAD Drawing Lab 1',
            class_room=class_room,
            defaults={
                'lecturer': lecturer,
                'required_vm_template': autocad_template,
                'scheduled_date': date(2026, 7, 7),
                'start_time': time(8, 0),
                'end_time': time(11, 0),
                'status': PracticalSession.Status.SCHEDULED,
                'instructions': 'Complete Drawing Sheet 1 using AutoCAD. Save as PDF before submitting.',
                'max_concurrent_vms': 30,
                'auto_terminate': True,
            }
        )'''

session_new = '''        tomorrow = timezone.now() + timedelta(days=1)
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
        )'''
content = content.replace(session_old, session_new)

with open('apps/vms/management/commands/seed_data.py', 'w', encoding='utf-8') as f:
    f.write(content)
