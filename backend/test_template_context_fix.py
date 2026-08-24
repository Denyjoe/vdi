"""
Test: Verify the /vms/templates/ endpoint returns correct templates
based on the ?context= query parameter.

Run with: python manage.py shell < test_template_context_fix.py
"""
from rest_framework.test import APIClient
from apps.users.models import User
from apps.vms.models import VMTemplate
from apps.university.models import University, Department, UniversityAffiliation

# Create test user
user, _ = User.objects.get_or_create(
    email='__test_ctx_fix__@test.com',
    defaults={'first_name': 'Ctx', 'last_name': 'Test', 'role': 'lecturer'}
)
user.set_password('test1234')
user.save()

# Create university + affiliation
uni, _ = University.objects.get_or_create(
    name='__Test Context Fix University__',
    defaults={'contact_email': 'ctx@test.com', 'contact_name': 'Test', 'status': 'active'}
)
dept, _ = Department.objects.get_or_create(
    university=uni, name='__Test Dept__', defaults={'code': 'TCTX'}
)
aff, _ = UniversityAffiliation.objects.get_or_create(
    user=user, university=uni, department=dept, role='lecturer',
    defaults={'is_active': True}
)

# Create a university-scoped template
uni_template, _ = VMTemplate.objects.get_or_create(
    name='__CTX_FIX__ Uni-Scoped Template',
    defaults={
        'university': uni, 'cpu_cores': 2, 'ram_gb': 4,
        'storage_gb': 40, 'is_available': True, 'price_per_hour': 1000,
    }
)
if uni_template.university_id != uni.id:
    uni_template.university = uni
    uni_template.save()

# Platform-wide template
platform_template, _ = VMTemplate.objects.get_or_create(
    name='__CTX_FIX__ Platform Template',
    university=None,
    defaults={
        'cpu_cores': 2, 'ram_gb': 4, 'storage_gb': 40,
        'is_available': True, 'price_per_hour': 500,
    }
)

client = APIClient()
client.force_authenticate(user=user)

print('=' * 60)
print('TEST: Template context fix verification')
print('=' * 60)

# Test 1: No context (old bug behavior)
res = client.get('/api/vms/templates/')
templates = res.data.get('data', [])
uni_names = [t['name'] for t in templates if '__CTX_FIX__ Uni-Scoped' in t['name']]
plat_names = [t['name'] for t in templates if '__CTX_FIX__ Platform' in t['name']]
print()
print('1. No ?context= (old CreateSessionPage behavior):')
print(f'   Uni template visible: {bool(uni_names)} (expect False)')
print(f'   Platform visible:     {bool(plat_names)} (expect True)')
assert not uni_names, 'BUG: Uni template should NOT appear without context'
assert plat_names, 'Platform template should appear without context'
print('   PASS')

# Test 2: University context (the fix)
res = client.get(f'/api/vms/templates/?context={uni.id}')
templates = res.data.get('data', [])
uni_names = [t['name'] for t in templates if '__CTX_FIX__ Uni-Scoped' in t['name']]
plat_names = [t['name'] for t in templates if '__CTX_FIX__ Platform' in t['name']]
print()
print(f'2. ?context={uni.id} (correct university context):')
print(f'   Uni template visible: {bool(uni_names)} (expect True)')
print(f'   Platform visible:     {bool(plat_names)} (expect False)')
assert uni_names, 'Uni template MUST appear with correct university context'
assert not plat_names, 'Platform template should NOT appear in university context'
print('   PASS')

# Test 3: Personal context (no regression)
res = client.get('/api/vms/templates/?context=personal')
templates = res.data.get('data', [])
uni_names = [t['name'] for t in templates if '__CTX_FIX__ Uni-Scoped' in t['name']]
plat_names = [t['name'] for t in templates if '__CTX_FIX__ Platform' in t['name']]
print()
print('3. ?context=personal (no regression):')
print(f'   Uni template visible: {bool(uni_names)} (expect False)')
print(f'   Platform visible:     {bool(plat_names)} (expect True)')
assert not uni_names, 'Uni template should NOT appear in personal context'
assert plat_names, 'Platform template should appear in personal context'
print('   PASS')

print()
print('=' * 60)
print('ALL 3 TESTS PASSED')
print('=' * 60)

# Cleanup
uni_template.delete()
platform_template.delete()
aff.delete()
dept.delete()
uni.delete()
user.delete()
print('Test data cleaned up.')
