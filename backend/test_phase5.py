import os
import django
import json
from io import BytesIO

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.users.models import User
from apps.assignments import views
from apps.classes.models import Class

factory = APIRequestFactory()

def print_result(test_name, response):
    print(f"\n{'='*50}\n{test_name}\n{'='*50}")
    print(f"Status: {response.status_code}")
    
    try:
        if response.status_code == 204:
            print("No Content")
        elif hasattr(response, 'data'):
            print(json.dumps(response.data, indent=2, default=str))
        else:
            print("Response:", response.content)
    except Exception as e:
        print(f"Could not parse response: {e}")

# Get users
shija = User.objects.get(email='shija@dit.ac.tz')
denis = User.objects.get(email='denis@dit.ac.tz')

# Make sure class 1 belongs to shija, denis is enrolled
class_room = Class.objects.get(id=1)
if class_room.lecturer != shija:
    class_room.lecturer = shija
    class_room.save()
if not class_room.enrollments.filter(student=denis).exists():
    from apps.classes.models import ClassEnrollment
    ClassEnrollment.objects.create(class_room=class_room, student=denis)

# Make a dummy file
dummy_file_content = b"This is a test file content for AutoCAD Lab."
lab_file = SimpleUploadedFile("lab_sheet.txt", dummy_file_content, content_type="text/plain")

# ---------------------------------------------------------
# TEST A: Lecturer uploads a file
# ---------------------------------------------------------
req_a = factory.post(
    '/api/assignments/files/upload/',
    {
        'title': 'AutoCAD Lab Sheet Week 1',
        'class_room_id': class_room.id,
        'description': 'Complete exercises 1-5',
        'file': lab_file
    },
    format='multipart',
    HTTP_HOST='localhost'
)
force_authenticate(req_a, user=shija)
view_a = views.LecturerFileUploadView.as_view()
res_a = view_a(req_a)
print_result("TEST A - Lecturer uploads a file", res_a)

# ---------------------------------------------------------
# TEST B: Lecturer creates an assignment
# ---------------------------------------------------------
req_b = factory.post(
    '/api/assignments/create/',
    {
        'title': 'AutoCAD Floor Plan Project',
        'description': 'Design a floor plan...',
        'class_room': class_room.id,
        'due_date': '2026-07-30T23:59:00Z',
        'max_file_size_mb': 20
    },
    format='json',
    HTTP_HOST='localhost'
)
force_authenticate(req_b, user=shija)
view_b = views.LecturerAssignmentCreateView.as_view()
res_b = view_b(req_b)
print_result("TEST B - Lecturer creates an assignment", res_b)

assignment_id = res_b.data.get('data', {}).get('id') if hasattr(res_b, 'data') and res_b.data.get('success') else None

# ---------------------------------------------------------
# TEST C: Student views assignments
# ---------------------------------------------------------
req_c = factory.get('/api/assignments/student/', HTTP_HOST='localhost')
force_authenticate(req_c, user=denis)
view_c = views.StudentAssignmentListView.as_view()
res_c = view_c(req_c)
print_result("TEST C - Student views assignments", res_c)

# ---------------------------------------------------------
# TEST D: Student submits assignment
# ---------------------------------------------------------
if assignment_id:
    submission_file = SimpleUploadedFile("floor_plan.dwg", b"DWG CONTENT", content_type="application/octet-stream")
    req_d = factory.post(
        '/api/assignments/submit/',
        {
            'assignment_id': assignment_id,
            'file': submission_file,
            'notes': 'Here is my submission.'
        },
        format='multipart',
        HTTP_HOST='localhost'
    )
    force_authenticate(req_d, user=denis)
    view_d = views.StudentSubmitView.as_view()
    res_d = view_d(req_d)
    print_result("TEST D - Student submits assignment", res_d)

    # ---------------------------------------------------------
    # TEST E: Student tries to submit again
    # ---------------------------------------------------------
    submission_file2 = SimpleUploadedFile("floor_plan_v2.dwg", b"DWG CONTENT V2", content_type="application/octet-stream")
    req_e = factory.post(
        '/api/assignments/submit/',
        {
            'assignment_id': assignment_id,
            'file': submission_file2,
            'notes': 'Trying to submit again.'
        },
        format='multipart',
        HTTP_HOST='localhost'
    )
    force_authenticate(req_e, user=denis)
    res_e = view_d(req_e)
    print_result("TEST E - Student tries to submit again", res_e)

    # ---------------------------------------------------------
    # TEST F: Lecturer views submissions
    # ---------------------------------------------------------
    req_f = factory.get(f'/api/assignments/{assignment_id}/submissions/', HTTP_HOST='localhost')
    force_authenticate(req_f, user=shija)
    view_f = views.LecturerSubmissionsView.as_view()
    res_f = view_f(req_f, assignment_id=assignment_id)
    print_result("TEST F - Lecturer views submissions", res_f)
else:
    print("Skipping tests D, E, F as assignment creation failed.")
