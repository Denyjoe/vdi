import requests

# Login as shija (lecturer)
res = requests.post(
  'http://localhost:8000/api/auth/login/',
  json={'email': 'shija@dit.ac.tz',
        'password': 'Test1234!'})
token = res.json()['data']['access']
print('Shija logged in:', 
  res.status_code)

# Get class 1 id
res2 = requests.get(
  'http://localhost:8000/api/classes/my-classes/',
  headers={'Authorization': 
    f'Bearer {token}'})
classes = res2.json().get('data', [])
if not classes:
  print('ERROR: Shija has no classes')
  exit()
class_id = classes[0]['id']
print(f'Using class: {classes[0]["name"]} (id={class_id})')

# Shija posts assignment to class
res3 = requests.post(
  'http://localhost:8000/api/assignments/create/',
  headers={'Authorization': f'Bearer {token}'},
  json={
    'title': 'ISOLATION TEST',
    'description': 'Only enrolled students should see this',
    'class_room': class_id,
    'due_date': '2026-08-01T23:59:00Z',
    'max_file_size_mb': 10
  })
print('Create assignment status:', res3.status_code)
if res3.status_code != 201:
  print('ERROR:', res3.json())
  exit()
print('Assignment created:', 
  res3.json()['data']['title'])

# Login as denis (enrolled)
res4 = requests.post(
  'http://localhost:8000/api/auth/login/',
  json={'email': 'denis@dit.ac.tz',
        'password': 'Test1234!'})
token_denis = res4.json()['data']['access']

# Denis fetches assignments
res5 = requests.get(
  'http://localhost:8000/api/assignments/student/',
  headers={'Authorization': 
    f'Bearer {token_denis}'})
denis_assignments = res5.json().get('data', [])
denis_sees = [a['title'] for a in denis_assignments]
print(f'Denis sees {len(denis_assignments)} assignments:')
for title in denis_sees:
  print(f'  - {title}')

# Register outside student
res6 = requests.post(
  'http://localhost:8000/api/auth/register/',
  json={
    'first_name': 'Outside',
    'last_name': 'Student',
    'email': 'outside_test@dit.ac.tz',
    'password': 'Test1234!',
    'confirm_password': 'Test1234!',
    'role': 'student',
    'department': 1,
    'programme': 9,
    'year_of_study': 2,
    'student_id': 'OUT999'
  })
if res6.status_code not in [200, 201]:
  print('Register error:', res6.json())
  exit()
token_outside = res6.json()['data']['access']
print('Outside student registered')

# Outside student fetches assignments
res7 = requests.get(
  'http://localhost:8000/api/assignments/student/',
  headers={'Authorization': 
    f'Bearer {token_outside}'})
outside_assignments = res7.json().get('data', [])
print(f'Outside student sees: '
  f'{len(outside_assignments)} assignments')

# Final verdict
isolation_pass = len(outside_assignments) == 0
denis_pass = len(denis_assignments) > 0
print()
print('=== ISOLATION TEST RESULTS ===')
print(f'Denis sees content: '
  f'{"PASS" if denis_pass else "FAIL"}')
print(f'Outside student blocked: '
  f'{"PASS" if isolation_pass else "FAIL"}')
print(f'OVERALL: '
  f'{"PASS" if (isolation_pass and denis_pass) else "FAIL"}')
