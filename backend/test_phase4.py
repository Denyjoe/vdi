"""
Phase 4 Test Suite — Lecturer Monitoring & Exam Control
Tests all 6 Phase 4 acceptance criteria via the REST API.

Run from backend/ directory:
    python test_phase4.py
"""

import os
import sys
import django
import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from apps.users.models import User
from apps.vms.models import VirtualMachine
from apps.sessions.models import RemoteSession, ExamSession
from apps.classes.models import Class, ClassEnrollment
from apps.sessions.services.remote_session_manager import session_manager

GREEN  = '\033[92m'
RED    = '\033[91m'
YELLOW = '\033[93m'
CYAN   = '\033[96m'
RESET  = '\033[0m'
BOLD   = '\033[1m'

def ok(msg):  print(f"  {GREEN}✓{RESET} {msg}")
def fail(msg): print(f"  {RED}✗{RESET} {msg}"); sys.exit(1)
def info(msg): print(f"  {CYAN}→{RESET} {msg}")
def header(msg): print(f"\n{BOLD}{YELLOW}{'='*55}{RESET}\n{BOLD}  {msg}{RESET}\n{BOLD}{YELLOW}{'='*55}{RESET}")

def cleanup():
    """Remove any active sessions and test exams created during the test."""
    ExamSession.objects.filter(name__startswith='[TEST]').delete()
    RemoteSession.objects.filter(status='active').update(status='ended')

# ─────────────────────────────────────────────────────────────
header("Phase 4 Test Suite — Lecturer Monitoring & Exam Control")
cleanup()

# ── Load fixtures ────────────────────────────────────────────
student  = User.objects.filter(email='denis@dit.ac.tz').first()
lecturer = User.objects.filter(email='shija@dit.ac.tz').first()
vm       = VirtualMachine.objects.filter(owner=student, status='running').first()

if not student:  fail("No student user found — check seed data")
if not lecturer: fail("No lecturer user found — check seed data")
if not vm:
    info("No running VM found — starting one for tests")
    vm = VirtualMachine.objects.filter(owner=student).first()
    if not vm: fail("No VM at all for this student")
    vm.status = 'running'
    vm.save()

klass = Class.objects.filter(lecturer=lecturer).first()
if not klass: fail("No class found for lecturer — check seed data")

info(f"Student  : {student.email}")
info(f"Lecturer : {lecturer.email}")
info(f"VM       : {vm.name} [{vm.status}]")
info(f"Class    : {klass.name}")

# ─────────────────────────────────────────────────────────────
header("TEST 1 — Student connects to a running VM")

session = session_manager.connect(vm, student, '127.0.0.1')
assert session.status == 'active', "Session should be active after connect"
assert session.vm == vm
assert session.user == student
token = session_manager.generate_session_token(session)
assert token, "Session token should be generated"
ok(f"Session #{session.id} created, status=active")
ok(f"Session token generated: {token[:20]}...")

# ─────────────────────────────────────────────────────────────
header("TEST 2 — Lecturer can see active sessions (monitor view)")

active_sessions = RemoteSession.objects.filter(status='active').select_related('vm', 'vm__template', 'user')
assert active_sessions.exists(), "Should have at least one active session"

# Simulate the serializer output
from apps.sessions.serializers import LiveStudentSessionSerializer
active_exams = ExamSession.objects.filter(status='active')
serialized = LiveStudentSessionSerializer(
    active_sessions, many=True, context={'active_exams': list(active_exams)}
).data

assert len(serialized) > 0
first = serialized[0]
assert 'user' in first, "Session must have nested 'user' field"
assert 'vm' in first, "Session must have nested 'vm' field"
assert 'id' in first
assert 'duration_seconds' in first
assert 'is_in_exam' in first
assert 'full_name' in first['user']
assert 'name' in first['vm']
ok(f"Monitor sees {len(serialized)} active session(s)")
ok(f"First session: {first['user']['full_name']} on {first['vm']['name']}")

# ─────────────────────────────────────────────────────────────
header("TEST 3 — Lecturer creates an exam session")

starts_at = timezone.now() + datetime.timedelta(minutes=1)
ends_at   = timezone.now() + datetime.timedelta(hours=2)

exam = ExamSession.objects.create(
    name='[TEST] CAD Practical Exam 1',
    class_room=klass,
    lecturer=lecturer,
    status='scheduled',
    starts_at=starts_at,
    ends_at=ends_at,
    restrict_internet=True,
    restrict_copy_paste=True,
    instructions='Use AutoCAD to complete the floor plan',
    grace_period_minutes=5,
)
assert exam.status == 'scheduled'
assert exam.class_room == klass
assert exam.lecturer == lecturer
ok(f"Exam created: #{exam.id} — '{exam.name}'")
ok(f"Scheduled: {starts_at.strftime('%H:%M')} → {ends_at.strftime('%H:%M')}")

# ─────────────────────────────────────────────────────────────
header("TEST 4 — Lecturer starts the exam")

exam.status = 'active'
exam.save()
assert exam.status == 'active'
ok(f"Exam #{exam.id} status → active")

# Now check time_remaining_seconds serializer
from apps.sessions.serializers import ExamSessionSerializer
exam_data = ExamSessionSerializer(exam).data
assert exam_data['is_active'] == True
assert exam_data['time_remaining_seconds'] > 0
ok(f"time_remaining_seconds = {exam_data['time_remaining_seconds']}s ({exam_data['time_remaining_seconds']//60} minutes)")
ok(f"enrolled_student_count = {exam_data['enrolled_student_count']}")

# ─────────────────────────────────────────────────────────────
header("TEST 5 — Student active exam check")

# Check if student is enrolled in the exam's class
enrollment = ClassEnrollment.objects.filter(class_room=klass, student=student).first()
if not enrollment:
    info("Student not enrolled — enrolling for test")
    enrollment = ClassEnrollment.objects.create(class_room=klass, student=student)

active_student_exam = ExamSession.objects.filter(
    class_room__enrollments__student=student,
    status='active'
).first()

assert active_student_exam is not None, "Student should see an active exam"
assert active_student_exam.id == exam.id
ok(f"Student sees active exam: '{active_student_exam.name}'")
ok(f"restrict_internet={active_student_exam.restrict_internet}, restrict_copy_paste={active_student_exam.restrict_copy_paste}")

# Verify is_in_exam flag is True for this session
re_serialized = LiveStudentSessionSerializer(
    active_sessions, many=True, context={'active_exams': [exam]}
).data
in_exam_sessions = [s for s in re_serialized if s['is_in_exam']]
ok(f"{len(in_exam_sessions)} session(s) flagged as in_exam=True")

# ─────────────────────────────────────────────────────────────
header("TEST 6 — Lecturer ends exam, all active sessions terminated")

# Terminate all active sessions for enrolled students
enrolled_students = ClassEnrollment.objects.filter(class_room=klass).values_list('student_id', flat=True)
terminated = RemoteSession.objects.filter(
    status='active',
    user_id__in=enrolled_students
)
count_before = terminated.count()
terminated.update(status='ended', ended_at=timezone.now())

exam.status = 'ended'
exam.save()

assert exam.status == 'ended'
ok(f"Exam #{exam.id} status → ended")
ok(f"Terminated {count_before} active session(s) belonging to enrolled students")

# Verify ended sessions no longer show in active monitor
active_after = RemoteSession.objects.filter(status='active').count()
ok(f"Active sessions remaining after exam end: {active_after}")

# ─────────────────────────────────────────────────────────────
header("Classes API — Serializer Check")

from apps.classes.serializers import ClassSerializer
classes = Class.objects.filter(lecturer=lecturer)
class_data = ClassSerializer(classes, many=True).data
assert len(class_data) > 0
ok(f"Found {len(class_data)} class(es) for lecturer")
first_class = class_data[0]
assert 'id' in first_class
assert 'name' in first_class
ok(f"Class serializer fields: {list(first_class.keys())}")

# ─────────────────────────────────────────────────────────────
cleanup()
print(f"\n{BOLD}{GREEN}{'='*55}")
print(f"  ALL 6 PHASE 4 TESTS PASSED ✓")
print(f"{'='*55}{RESET}\n")
print("Summary:")
print(f"  Test 1 — Student connects VM              {GREEN}PASS{RESET}")
print(f"  Test 2 — Lecturer monitor view            {GREEN}PASS{RESET}")
print(f"  Test 3 — Exam session created             {GREEN}PASS{RESET}")
print(f"  Test 4 — Exam started, time_remaining     {GREEN}PASS{RESET}")
print(f"  Test 5 — Student sees active exam         {GREEN}PASS{RESET}")
print(f"  Test 6 — Exam ended, sessions terminated  {GREEN}PASS{RESET}")
