from apps.classes.models import (
  Department, Programme, CourseStream)
from apps.users.models import User

print('=== ACADEMIC STRUCTURE ===')
for dept in Department.objects.all():
  progs = dept.programmes.count()
  print(f'{dept.code}: {dept.name}')
  print(f'  Programmes: {progs}')
  for prog in dept.programmes.all():
    streams = prog.streams.count()
    print(f'    [{prog.level}] '
      f'{prog.code} — {prog.name} '
      f'({streams} streams)')

print()
print(f'TOTALS:')
print(f'  Departments: '
  f'{Department.objects.count()}')
print(f'  Programmes: '
  f'{Programme.objects.count()}')
print(f'  Streams: '
  f'{CourseStream.objects.count()}')

print()
print('=== DENIS PROFILE ===')
try:
  d = User.objects.get(
    email='denis@dit.ac.tz')
  print(f'Name: {d.get_full_name()}')
  print(f'Department: '
    f'{d.department.name if d.department else None}')
  print(f'Programme: '
    f'{d.programme.name if d.programme else None}')
  print(f'Level: '
    f'{d.programme.level if d.programme else None}')
  print(f'NTA: '
    f'{d.programme.nta_range if d.programme else None}')
  print(f'Stream: '
    f'{d.stream.code if d.stream else None}')
  print(f'Year: {d.year_of_study}')
except Exception as e:
  print(f'ERROR: {e}')

print()
print('=== ALL USERS ===')
for u in User.objects.all():
  print(f'  {u.email} [{u.role}]')

print()
print('=== PRACTICAL SESSION ===')
try:
  from apps.sessions.models import (
    PracticalSession,
    StudentPracticalAccess)
  p = PracticalSession.objects.first()
  if p:
    print(f'Name: {p.name}')
    print(f'Type: {p.session_type}')
    print(f'VM Template: '
      f'{p.required_vm_template}')
    print(f'Submission type: '
      f'{p.submission_type}')
    print(f'Access records: '
      f'{p.student_access.count()}')
  else:
    print('No practical sessions found')
except Exception as e:
  print(f'ERROR: {e}')

print()
print('=== VM TEMPLATES ===')
from apps.vms.models import VMTemplate
print(f'Templates: '
  f'{VMTemplate.objects.count()}')
for t in VMTemplate.objects.all()[:5]:
  print(f'  {t.id}: {t.name}')
