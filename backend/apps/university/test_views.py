"""
Phase 3 — real, end-to-end HTTP-level tests for the SuperAdmin management
layer. Uses DRF's APIClient against the REAL, wired-up URLs (not direct
view function calls) so routing, permission classes, and serialization
are all genuinely exercised together. Authentication is done via
force_authenticate (the standard DRF test mechanism) since the real
login path uses Firebase token verification, which these tests
deliberately don't re-implement — everything downstream of "who is this
request.user" runs for real.
"""
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from django.test import TestCase

from apps.users.models import User
from .models import University, UniversityAffiliation, UniversityInvoice
from .permissions import get_user_university_role


class PublicRequestAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_anonymous_user_can_submit_real_request(self):
        resp = self.client.post('/api/university/request-access/', {
            'name': '__TEST__ Dodoma Institute of Technology',
            'contact_email': 'registrar@dit-test.example',
            'contact_name': 'Jane Registrar',
            'description': 'A real, disposable test submission.',
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data['success'])
        uni_id = resp.data['data']['id']

        uni = University.objects.get(id=uni_id)
        self.assertEqual(uni.status, 'pending')
        self.assertEqual(uni.contact_email, 'registrar@dit-test.example')

    def test_missing_required_fields_rejected(self):
        resp = self.client.post('/api/university/request-access/', {
            'name': '', 'contact_email': '', 'contact_name': '',
        }, format='json')
        self.assertEqual(resp.status_code, 400)


class SuperAdminAccessControlTests(TestCase):
    """Real, attempted access against the live SuperAdmin endpoints by
    non-SuperAdmin accounts."""

    def setUp(self):
        self.client = APIClient()
        self.regular_user = User.objects.create_user(
            username='__test_regular__', email='regular@test.com', password='pw12345')
        self.platform_admin = User.objects.create_user(
            username='__test_platform_admin__', email='platadmin@test.com',
            password='pw12345', role='admin')
        self.superadmin = User.objects.create_superuser(
            username='__test_superadmin__', email='superadmin@test.com', password='pw12345')

    def test_unauthenticated_request_blocked(self):
        resp = self.client.get('/api/superadmin/university/universities/')
        self.assertIn(resp.status_code, (401, 403))

    def test_regular_user_blocked(self):
        self.client.force_authenticate(self.regular_user)
        resp = self.client.get('/api/superadmin/university/universities/')
        self.assertEqual(resp.status_code, 403)

    def test_regular_platform_admin_blocked_too(self):
        """The critical distinction: role='admin' (regular platform admin)
        is NOT the same as is_superuser — real attempted access."""
        self.client.force_authenticate(self.platform_admin)
        resp = self.client.get('/api/superadmin/university/universities/')
        self.assertEqual(resp.status_code, 403)

    def test_real_superadmin_allowed(self):
        """Positive control."""
        self.client.force_authenticate(self.superadmin)
        resp = self.client.get('/api/superadmin/university/universities/')
        self.assertEqual(resp.status_code, 200)


class FullApprovalFlowTests(TestCase):
    """The exact scenario the user asked to see: a real request submitted,
    reviewed, approved with real negotiated terms, and reflected
    correctly — end to end, over real HTTP."""

    def setUp(self):
        self.client = APIClient()
        self.superadmin = User.objects.create_superuser(
            username='__test_flow_superadmin__', email='flow_superadmin@test.com', password='pw12345')
        # The person who will become the university's admin must already
        # be a real, existing Ospace account (per the design decision).
        self.future_uni_admin = User.objects.create_user(
            username='__test_future_uni_admin__', email='future_admin@dit-test.example', password='pw12345')

    def test_full_request_review_approve_cycle(self):
        # 1. Real, public submission.
        submit_resp = self.client.post('/api/university/request-access/', {
            'name': '__TEST__ University of Zanzibar',
            'contact_email': 'contact@uoz-test.example',
            'contact_name': 'Amina Contact',
            'description': 'Real disposable test university.',
        }, format='json')
        self.assertEqual(submit_resp.status_code, 201)
        uni_id = submit_resp.data['data']['id']

        # 2. SuperAdmin reviews the pending list — the real request appears.
        self.client.force_authenticate(self.superadmin)
        pending_resp = self.client.get('/api/superadmin/university/universities/?status=pending')
        self.assertEqual(pending_resp.status_code, 200)
        pending_ids = [u['id'] for u in pending_resp.data['data']]
        self.assertIn(uni_id, pending_ids)

        # 3. SuperAdmin approves with real, negotiated terms.
        approve_resp = self.client.post(
            f'/api/superadmin/university/universities/{uni_id}/approve/', {
                'admin_user_email': 'future_admin@dit-test.example',
                'seats_allocated': 250,
                'price_per_seat_tzs': '15000.00',
                'billing_cycle': 'semester',
                'max_vcpu_cores': 64,
                'max_ram_gb': 256,
                'max_storage_gb': 2000,
            }, format='json')
        self.assertEqual(approve_resp.status_code, 200, approve_resp.data)
        self.assertTrue(approve_resp.data['success'])
        data = approve_resp.data['data']
        self.assertEqual(data['status'], 'active')
        self.assertEqual(data['seats_allocated'], 250)
        self.assertEqual(data['price_per_seat_tzs'], 15000.0)
        self.assertEqual(data['billing_cycle'], 'semester')
        self.assertEqual(data['admin_user_email'], 'future_admin@dit-test.example')
        self.assertEqual(data['max_vcpu_cores'], 64)
        self.assertEqual(data['max_ram_gb'], 256)
        self.assertEqual(data['max_storage_gb'], 2000)

        # 4. Reflected correctly in the real DB row, not just the response.
        uni = University.objects.get(id=uni_id)
        self.assertEqual(uni.status, 'active')
        self.assertEqual(uni.admin_user_id, self.future_uni_admin.id)
        self.assertEqual(uni.seats_allocated, 250)
        self.assertEqual(uni.price_per_seat_tzs, Decimal('15000.00'))
        self.assertEqual(uni.approved_by_id, self.superadmin.id)
        self.assertIsNotNone(uni.approved_at)
        self.assertEqual(uni.max_vcpu_cores, 64)
        self.assertEqual(uni.max_ram_gb, 256)
        self.assertEqual(uni.max_storage_gb, 2000)

        # 5. The real permission boundary now genuinely recognizes the new
        # admin — proven via the same function Phase 2 tested adversarially.
        self.assertEqual(get_user_university_role(self.future_uni_admin, uni.id), 'admin')
        self.assertTrue(
            UniversityAffiliation.objects.filter(
                user=self.future_uni_admin, university=uni, role='admin', is_active=True,
            ).exists()
        )

        # 6. Real invoice lifecycle: create, list, mark paid.
        invoice_resp = self.client.post('/api/superadmin/university/invoices/', {
            'university_id': uni.id,
            'amount_tzs': '3750000.00',
            'billing_period_start': '2026-01-01',
            'billing_period_end': '2026-06-30',
            'due_date': '2026-01-15',
        }, format='json')
        self.assertEqual(invoice_resp.status_code, 201, invoice_resp.data)
        invoice_id = invoice_resp.data['data']['id']
        self.assertEqual(invoice_resp.data['data']['status'], 'pending')

        mark_paid_resp = self.client.post(
            f'/api/superadmin/university/invoices/{invoice_id}/status/',
            {'status': 'paid'}, format='json')
        self.assertEqual(mark_paid_resp.status_code, 200)
        self.assertEqual(mark_paid_resp.data['data']['status'], 'paid')
        self.assertEqual(mark_paid_resp.data['data']['marked_paid_by'], self.superadmin.email)

        invoice = UniversityInvoice.objects.get(id=invoice_id)
        self.assertEqual(invoice.status, 'paid')
        self.assertIsNotNone(invoice.paid_at)
        self.assertEqual(invoice.marked_paid_by_id, self.superadmin.id)

        # 7. Real revenue aggregate reflects the paid invoice, scoped to
        # university contracts only (not mixed with individual revenue).
        revenue_resp = self.client.get('/api/superadmin/university/revenue/')
        self.assertEqual(revenue_resp.status_code, 200)
        self.assertEqual(revenue_resp.data['total_paid_tzs'], 3750000.0)
        by_uni = {row['university_id']: row['amount_tzs'] for row in revenue_resp.data['by_university']}
        self.assertEqual(by_uni.get(uni.id), 3750000.0)

        # ── Cleanup: disposable test data ──────────────────────────────
        invoice.delete()
        UniversityAffiliation.objects.filter(university=uni).delete()
        uni.delete()

    def test_approve_with_nonexistent_admin_email_fails_honestly(self):
        submit_resp = self.client.post('/api/university/request-access/', {
            'name': '__TEST__ Ghost University',
            'contact_email': 'ghost@test.example',
            'contact_name': 'Nobody',
        }, format='json')
        uni_id = submit_resp.data['data']['id']

        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{uni_id}/approve/', {
            'admin_user_email': 'does_not_exist_anywhere@test.example',
            'seats_allocated': 10,
            'price_per_seat_tzs': '1000',
            'billing_cycle': 'annual',
        }, format='json')

        self.assertEqual(resp.status_code, 400)
        uni = University.objects.get(id=uni_id)
        self.assertEqual(uni.status, 'pending')  # untouched, not silently activated
        uni.delete()

    def test_reject_flow_with_real_reason(self):
        submit_resp = self.client.post('/api/university/request-access/', {
            'name': '__TEST__ Suspicious University',
            'contact_email': 'suspicious@test.example',
            'contact_name': 'Suspicious Person',
        }, format='json')
        uni_id = submit_resp.data['data']['id']

        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{uni_id}/reject/', {
            'reason': 'Could not verify institutional accreditation.',
        }, format='json')

        self.assertEqual(resp.status_code, 200)
        uni = University.objects.get(id=uni_id)
        self.assertEqual(uni.status, 'rejected')
        self.assertEqual(uni.rejection_reason, 'Could not verify institutional accreditation.')
        uni.delete()

    def test_regular_user_cannot_approve_even_their_own_request(self):
        """Real attempted privilege escalation: submitting the public form
        grants no elevated access to review/approve it."""
        submit_resp = self.client.post('/api/university/request-access/', {
            'name': '__TEST__ Self Escalation U',
            'contact_email': 'selfesc@test.example',
            'contact_name': 'Self Escalator',
        }, format='json')
        uni_id = submit_resp.data['data']['id']

        self.client.force_authenticate(self.future_uni_admin)  # a real but non-superadmin account
        resp = self.client.post(f'/api/superadmin/university/universities/{uni_id}/approve/', {
            'admin_user_email': self.future_uni_admin.email,
            'seats_allocated': 999,
            'price_per_seat_tzs': '1',
            'billing_cycle': 'annual',
        }, format='json')

        self.assertEqual(resp.status_code, 403)
        uni = University.objects.get(id=uni_id)
        self.assertEqual(uni.status, 'pending')
        uni.delete()
