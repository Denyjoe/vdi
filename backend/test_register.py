import requests

payload = {
    "first_name": "Test",
    "last_name": "Student",
    "email": "teststudent@dit.ac.tz",
    "role": "student",
    "password": "password123",
    "confirm_password": "password123",
    "department_id": 1,
    "programme_id": 9, # BENG-COE
    "stream_id": 6, # BENG24 COE-2
    "year_of_study": 4,
    "student_id": "123456789"
}

try:
    res = requests.post("http://localhost:8000/api/auth/register/", json=payload)
    print("Response Status:", res.status_code)
    print("Response JSON:", res.json())
except Exception as e:
    print("Error:", e)
