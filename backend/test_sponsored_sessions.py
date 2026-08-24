"""
Test script for university-sponsored session hosting payment/quota logic.
Run with: python manage.py shell -c "exec(open('test_sponsored_sessions.py', encoding='utf-8-sig').read())"
"""

from rest_framework.test import APIClient
from django.utils import timezone
from apps.users.models import User
from apps.vms.models import VMTemplate
from apps.sessions.models import LiveSession
from apps.university.models import University, Department, UniversityAffiliation, Course, CourseEnrollment
import decimal

print('=' * 60)
print('TEST: University Sponsored Sessions (Payment & Quota)')
print('=' * 60)

# 1. Setup Test Data
# Dual-identity user (lecturer + personal)
user, _ = User.objects.get_or_create(
    email='__test_dual_identity__@test.com',
    defaults={'first_name': 'Dual', 'last_name': 'Test', 'role': 'lecturer'}
)
user.set_password('test1234')
user.save()

# University setup
uni, _ = University.objects.get_or_create(
    name='__Test Sponsorship University__',
    defaults={
        'contact_email': 'spons@test.com', 
        'contact_name': 'Test', 
        'status': 'active',
        'max_vcpu_cores': 100,
        'max_ram_gb': 200,
        'max_storage_gb': 1000,
    }
)
# Force reset quotas in case of previous test failure
uni.max_vcpu_cores = 100
uni.max_ram_gb = 200
uni.max_storage_gb = 1000
uni.save()
dept, _ = Department.objects.get_or_create(
    university=uni, name='__Test Dept__', defaults={'code': 'TSPONS'}
)
aff, _ = UniversityAffiliation.objects.get_or_create(
    user=user, university=uni, department=dept, role='lecturer',
    defaults={'is_active': True}
)

# University-scoped template
uni_template, _ = VMTemplate.objects.get_or_create(
    name='__SPONS_FIX__ Uni-Scoped Template',
    defaults={
        'university': uni, 'cpu_cores': 2, 'ram_gb': 4,
        'storage_gb': 40, 'is_available': True, 'price_per_hour': 1000,
    }
)
if uni_template.university_id != uni.id:
    uni_template.university = uni
    uni_template.save()

# Platform-wide template (personal)
platform_template, _ = VMTemplate.objects.get_or_create(
    name='__SPONS_FIX__ Platform Template',
    university=None,
    defaults={
        'cpu_cores': 2, 'ram_gb': 4, 'storage_gb': 40,
        'is_available': True, 'price_per_hour': 500,
    }
)

# A real course taught by the lecturer
course, _ = Course.objects.get_or_create(
    department=dept, code='SPONS101',
    defaults={
        'name': 'Test Sponsorship Course', 
        'default_template': uni_template
    }
)
CourseEnrollment.objects.get_or_create(course=course, user=user, defaults={'role': 'lecturer'})

client = APIClient()
client.force_authenticate(user=user)

def count_sessions(user):
    return LiveSession.objects.filter(host=user).count()

initial_session_count = count_sessions(user)

# Test 1: Real lecturer starts a real class session
# Expect: Success, amount_paid_tzs = 0, university_sponsored = True
res = client.post('/api/sessions/live/pay-and-start/', {
    'name': 'Class Session',
    'hours': 2,
    'vm_template': uni_template.id,
    'course_id': course.id,
    # Phone number not provided - if payment was required, this would fail!
}, format='json')

print()
print('1. Real lecturer starts a real class session:')
if res.status_code != 200:
    print(f'   FAILED: {res.data}')
    assert False, 'Lecturer session start failed'

data = res.data.get('data', {})
print(f"   Success: {res.data.get('success')}")
print(f"   amount_paid_tzs: {data.get('amount_paid_tzs')}")
print(f"   university_sponsored: {data.get('university_sponsored')}")
print(f"   course_id: {data.get('course_id')}")

assert res.data.get('success') is True
assert data.get('amount_paid_tzs') == 0, "amount_paid_tzs should be exactly 0 for sponsored sessions"
assert data.get('university_sponsored') is True
assert data.get('course_id') == course.id
print('   PASS')

# Test 2: Personal session start (same user, but platform template, no course)
# Expect: Fails without phone_number because payment is required
res = client.post('/api/sessions/live/pay-and-start/', {
    'name': 'Personal Session',
    'hours': 1,
    'vm_template': platform_template.id,
    # No course_id
}, format='json')

print()
print('2. Personal session start without payment info (Regression test):')
# Payment requires phone number
assert res.status_code == 500 or (res.status_code == 200 and res.data.get('success') is False) or 'IntegrityError' in str(res.content)
# Actually, the view requires provider/phone at payment time. Let's provide phone and see if amount_paid > 0
res_paid = client.post('/api/sessions/live/pay-and-start/', {
    'name': 'Personal Session Paid',
    'hours': 1,
    'vm_template': platform_template.id,
    'phone_number': '0712345678',
    'provider': 'mpesa'
}, format='json')

data_paid = res_paid.data.get('data', {})
print(f"   Success: {res_paid.data.get('success')}")
print(f"   amount_paid_tzs: {data_paid.get('amount_paid_tzs')}")
print(f"   university_sponsored: {data_paid.get('university_sponsored')}")

assert res_paid.data.get('success') is True
assert data_paid.get('amount_paid_tzs') > 0, "amount_paid_tzs should be > 0 for personal sessions"
assert data_paid.get('university_sponsored') is False
print('   PASS')

# Test 3: Quota enforcement check
# We will temporarily drop the university quota to a very low number to see it reject
uni.max_vcpu_cores = 1
uni.save()

res_quota = client.post('/api/sessions/live/pay-and-start/', {
    'name': 'Class Session Over Quota',
    'hours': 2,
    'vm_template': uni_template.id,
    'course_id': course.id,
}, format='json')

print()
print('3. University quota enforcement for class session:')
print(f"   Status code: {res_quota.status_code}")
print(f"   Message: {res_quota.data.get('message', '')}")
assert res_quota.status_code == 409
assert 'quota' in res_quota.data.get('message', '').lower()
print('   PASS')

# Restore quota
uni.max_vcpu_cores = 100
uni.save()

print()
print('=' * 60)
print('ALL TESTS PASSED')
print('=' * 60)

# Cleanup
LiveSession.objects.filter(host=user).delete()
course.delete()
uni_template.delete()
platform_template.delete()
aff.delete()
dept.delete()
uni.delete()
user.delete()
print('Test data cleaned up.')
