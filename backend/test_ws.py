import asyncio
import websockets
import requests
import json
import threading

API_URL = 'http://127.0.0.1:8000/api'
WS_URL = 'ws://127.0.0.1:8000/ws/notifications/'

def trigger_shija_assignment(shija_token):
    import time
    time.sleep(2)
    print('Tab 1: Shija creates an assignment via REST API...')
    data = {
        'class_room': 1,
        'title': 'WS Live Test Assignment',
        'description': 'This is a test assignment',
        'due_date': '2027-01-01T00:00:00Z',
        'points': 100
    }
    requests.post(f'{API_URL}/assignments/create/', data=data, headers={'Authorization': f'Bearer {shija_token}'})
    print('Assignment created by Shija.')

async def test_realtime():
    res = requests.post(f'{API_URL}/auth/login/', json={'email': 'denis@dit.ac.tz', 'password': 'Test1234!'})
    denis_token = res.json()['data']['access']
    
    res = requests.post(f'{API_URL}/auth/login/', json={'email': 'shija@dit.ac.tz', 'password': 'Test1234!'})
    shija_token = res.json()['data']['access']
    
    uri = f'{WS_URL}?token={denis_token}'
    try:
        async with websockets.connect(uri) as ws:
            print('Tab 2 (Denis): Notifications WS connected')
            
            t = threading.Thread(target=trigger_shija_assignment, args=(shija_token,))
            t.start()

            print('Tab 2 (Denis): Waiting for live push update...')
            message = await asyncio.wait_for(ws.recv(), timeout=10.0)
            data = json.loads(message)
            print(f'Bell Updates: Received LIVE WS Push: \"{data["data"]["title"]}\" -> \"{data["data"]["message"]}\"')
            
    except Exception as e:
        print(f'WebSocket Test Error: {e}')

asyncio.run(test_realtime())
