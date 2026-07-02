import os
import requests

print('--- 1. Pages in frontend/src/pages/ ---')
for root, _, files in os.walk('frontend/src/pages'):
    for f in files:
        if f.endswith('.jsx'):
            print(os.path.join(root, f).replace('\\', '/'))

print('\n--- 2. Routes in App.jsx ---')
with open('frontend/src/App.jsx', 'r') as f:
    for line in f:
        if '<Route ' in line and 'path=' in line:
            print(line.strip())

print('\n--- 3. Backend Endpoints ---')
API = 'http://localhost:8000/api'
try:
    r = requests.post(f'{API}/auth/login/', json={'email': 'instructor@clouddesk.io', 'password': 'Admin2026!'})
    token = r.json()['data']['access']
    h = {'Authorization': f'Bearer {token}'}

    tests = [
      ('Live Sessions List', requests.get(f'{API}/sessions/live/', headers=h)),
      ('Create Session', 'POST /api/sessions/live/create/'),
      ('Session Monitor', 'GET /api/sessions/live/{id}/monitor/'),
      ('Groups List', requests.get(f'{API}/groups/', headers=h)),
      ('Workspaces List', requests.get(f'{API}/workspaces/', headers=h)),
      ('Subscriptions Plans', requests.get(f'{API}/subscriptions/plans/')),
      ('VM Templates', requests.get(f'{API}/vms/templates/', headers=h)),
    ]

    for name, result in tests:
      if isinstance(result, str):
        print(f'  {name}: NOT TESTED (needs ID) - {result}')
      else:
        print(f'  {name}: {result.status_code}')
except Exception as e:
    print('Failed to test endpoints:', e)

print('\n--- 4. Specific Frontend Pages ---')
pages_to_check = [
    'frontend/src/pages/instructor/InstructorSessionsPage.jsx',
    'frontend/src/pages/instructor/SessionMonitorPage.jsx',
    'frontend/src/pages/member/MemberGroupsPage.jsx',
    'frontend/src/pages/member/MemberSessionsPage.jsx',
    'frontend/src/pages/shared/SessionsPage.jsx',
    'frontend/src/pages/shared/JoinSessionPage.jsx',
    'frontend/src/pages/public/LandingPage.jsx',
    'frontend/src/pages/public/PricingPage.jsx',
    'frontend/src/pages/public/TemplatesPage.jsx'
]
for p in pages_to_check:
    print(f"{p.split('/')[-1]}: {'EXISTS' if os.path.exists(p) else 'MISSING'}")

print('\n--- 5. Specific Modals ---')
modals_to_check = [
    'frontend/src/components/instructor/CreateLiveSessionModal.jsx',
    'frontend/src/components/instructor/CreateGroupModal.jsx',
    'frontend/src/components/member/CreateWorkspaceModal.jsx',
    'frontend/src/components/shared/JoinByCodeModal.jsx',
    'frontend/src/components/shared/UpgradeModal.jsx'
]
for m in modals_to_check:
    print(f"{m.split('/')[-1]}: {'EXISTS' if os.path.exists(m) else 'MISSING'}")
