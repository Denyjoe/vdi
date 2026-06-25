import requests
import json

BASE_URL = 'http://127.0.0.1:8000/api'

def get_token(email, password):
    res = requests.post(f'{BASE_URL}/auth/login/', json={'email': email, 'password': password})
    return res.json()['data']['access']

def run_tests():
    # Login as student
    student_token = get_token('student2@dit.ac.tz', 'Test1234!')
    
    # Login as lecturer
    lecturer_token = get_token('shija@dit.ac.tz', 'Test1234!')

    print("==================================================")
    print("TEST A - Student requests enrollment")
    print("==================================================")
    res = requests.post(
        f'{BASE_URL}/classes/1/request/',
        headers={'Authorization': f'Bearer {student_token}'},
        json={"message": "I want to join"}
    )
    print(f"Status: {res.status_code}")
    print(json.dumps(res.json(), indent=2))
    
    # Save the request ID for later tests
    req_id = 1
    if res.status_code == 200 and res.json().get('success'):
        req_id = res.json()['data']['id']
    else:
        # If already pending, let's try to find it
        pass

    print("\n==================================================")
    print("TEST B - Lecturer sees requests")
    print("==================================================")
    res = requests.get(
        f'{BASE_URL}/classes/1/requests/',
        headers={'Authorization': f'Bearer {lecturer_token}'}
    )
    print(f"Status: {res.status_code}")
    print(json.dumps(res.json(), indent=2))
    
    if res.status_code == 200 and len(res.json()['data']) > 0:
        req_id = res.json()['data'][0]['id']

    print("\n==================================================")
    print("TEST C - Lecturer approves")
    print("==================================================")
    res = requests.post(
        f'{BASE_URL}/classes/requests/{req_id}/approve/',
        headers={'Authorization': f'Bearer {lecturer_token}'}
    )
    print(f"Status: {res.status_code}")
    print(json.dumps(res.json(), indent=2))

    print("\n==================================================")
    print("TEST D - Lecturer creates new class")
    print("==================================================")
    res = requests.post(
        f'{BASE_URL}/classes/create/',
        headers={'Authorization': f'Bearer {lecturer_token}'},
        json={
            "name": "Network Security Lab",
            "department": "Computer Engineering",
            "academic_year": "2025/2026",
            "stream": "B",
            "semester": 2,
            "max_students": 30
        }
    )
    print(f"Status: {res.status_code}")
    print(json.dumps(res.json(), indent=2))

if __name__ == '__main__':
    run_tests()
