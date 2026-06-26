import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.classes.models import Department, Programme, CourseStream
from apps.users.models import User
from apps.sessions.models import PracticalSession, StudentPracticalAccess
from apps.vms.models import VMTemplate

print('=== PROGRAMMES BY LEVEL ===')
print('DIPLOMA:')
for p in Programme.objects.filter(level='diploma').order_by('department__code', 'name'):
  print(f'  {p.code} — {p.name} [{p.department.code}] {p.nta_range}')

print('\nBACHELOR:')
for p in Programme.objects.filter(level='bachelor').order_by('department__code', 'name'):
  print(f'  {p.code} — {p.name} [{p.department.code}] {p.nta_range}')

print('\nMASTER:')
for p in Programme.objects.filter(level='master').order_by('department__code', 'name'):
  print(f'  {p.code} — {p.name} [{p.department.code}] {p.nta_range}')

print('\nTOTALS:')
print(f'  Diploma: {Programme.objects.filter(level="diploma").count()}')
print(f'  Bachelor: {Programme.objects.filter(level="bachelor").count()}')
print(f'  Master: {Programme.objects.filter(level="master").count()}')
print(f'  Total: {Programme.objects.count()}')
print(f'  Streams: {CourseStream.objects.count()}')

print('\n=== DENIS FULL PROFILE ===')
d = User.objects.get(email='denis@dit.ac.tz')
prog = d.programme
stream = d.stream
print(f'Name: {d.get_full_name()}')
print(f'Email: {d.email}')
print(f'Role: {d.role}')
print(f'Department: {d.department.name if d.department else "MISSING"}')
print(f'Programme: {prog.name if prog else "MISSING"}')
print(f'Level: {prog.level if prog else "MISSING"}')
print(f'NTA Range: {prog.nta_range if prog else "MISSING"}')
print(f'Duration: {prog.duration_years if prog else "MISSING"} years')
print(f'Stream: {stream.code if stream else "MISSING"}')
print(f'Year of Study: {d.year_of_study}')

print('\n=== PRACTICAL SESSION ===')
p = PracticalSession.objects.first()
if p:
  print(f'Name: {p.name}')
  print(f'Type: {p.session_type}')
  print(f'VM: {p.required_vm_template}')
  print(f'Submit type: {p.submission_type}')
  print(f'Start: {p.start_time}')
  print(f'End: {p.end_time}')
  print(f'Access records: {p.student_access.count()}')
else:
  print('NO PRACTICAL SESSION FOUND')

print('\n=== VM TEMPLATES ===')
print(f'Total: {VMTemplate.objects.count()}')
for t in VMTemplate.objects.filter(is_available=True)[:5]:
  print(f'  {t.id}: {t.name}')

print('\n=== ALL USERS ===')
for u in User.objects.all().order_by('role', 'email'):
  dept = u.department.code if u.department else '-'
  prog = u.programme.code if u.programme else '-'
  print(f'  [{u.role}] {u.email} dept={dept} prog={prog}')
