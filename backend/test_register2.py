import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.classes.models import Department, Programme, CourseStream
from apps.users.models import User

# Clean up previous test if exists
User.objects.filter(email='teststudent@dit.ac.tz').delete()

dept = Department.objects.get(code='CS')
prog = Programme.objects.get(code='BENG-COE')
stream = CourseStream.objects.get(code='BENG24 COE-2')

payload = {
    "first_name": "Test",
    "last_name": "Student",
    "email": "teststudent@dit.ac.tz",
    "role": "student",
    "password": "password123",
    "confirm_password": "password123",
    "department": dept.id,
    "programme": prog.id,
    "stream": stream.id,
    "year_of_study": 4,
    "student_id": "123456789"
}

try:
    res = requests.post("http://localhost:8000/api/auth/register/", json=payload)
    print("Response Status:", res.status_code)
    print("Response JSON:", res.json())
except Exception as e:
    print("Error:", e)

u = User.objects.order_by('-created_at').first()
print('=== NEW USER ===')
print(f'Name: {u.get_full_name()}')
print(f'Dept: {u.department}')
print(f'Prog: {u.programme}')
print(f'Stream: {u.stream}')
print(f'Year: {u.year_of_study}')
