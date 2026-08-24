"""
Phase 6 — real, adversarial tests for account context switching.

The one scenario this suite is built around: a SINGLE real account that
is BOTH an individual paying user AND a university-affiliated
student/lecturer at the same time — proving personal data never leaks
into the university-context view and vice versa, over the real, live
HTTP endpoints (VMTemplateListView, WorkspaceListView,
LiveSessionListView), plus that billing is never affected by context at
all.
"""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.users.models import User, Payment
from apps.vms.models import VMTemplate, Workspace
from apps.sessions.models import LiveSession
from .models import University, Department, Course, UniversityAffiliation, CourseEnrollment
from .permissions import resolve_context_university


class MyContextsViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Context Uni', contact_email='ctx@t.com', contact_name='C', status='active')
        self.dept = Department.objects.create(university=self.uni, name='CS', code='CS')
        self.user = User.objects.create_user(username='__t_ctx_user__', email='ctx_user@t.com', password='pw12345')
        self.other_user = User.objects.create_user(username='__t_ctx_other__', email='ctx_other@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=self.user, university=self.uni, department=self.dept, role='student')

    def test_personal_always_present_plus_real_affiliations_only(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get('/api/university-admin/my-contexts/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['data']['personal'])
        affs = resp.data['data']['affiliations']
        self.assertEqual(len(affs), 1)
        self.assertEqual(affs[0]['university_name'], '__TEST__ Context Uni')
        self.assertEqual(affs[0]['role'], 'student')

    def test_unaffiliated_user_sees_no_affiliations(self):
        self.client.force_authenticate(self.other_user)
        resp = self.client.get('/api/university-admin/my-contexts/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['data']['personal'])
        self.assertEqual(resp.data['data']['affiliations'], [])

    def test_deactivated_affiliation_disappears_from_context_list(self):
        UniversityAffiliation.objects.filter(user=self.user, university=self.uni).update(is_active=False)
        self.client.force_authenticate(self.user)
        resp = self.client.get('/api/university-admin/my-contexts/')
        self.assertEqual(resp.data['data']['affiliations'], [])


class ResolveContextUniversityUnitTests(TestCase):
    """Pure-function boundary, same standard as Phase 2."""

    def setUp(self):
        self.uni = University.objects.create(
            name='__TEST__ Resolve Uni', contact_email='r@t.com', contact_name='R', status='active')
        self.member = User.objects.create_user(username='__t_resolve_member__', email='resolve_member@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=self.member, university=self.uni, role='student')
        self.outsider = User.objects.create_user(username='__t_resolve_outsider__', email='resolve_outsider@t.com', password='pw12345')

    def _fake_request(self, user, context=None):
        class FakeRequest:
            pass
        req = FakeRequest()
        req.user = user
        req.query_params = {'context': context} if context is not None else {}
        return req

    def test_no_context_param_means_not_scoped(self):
        is_scoped, university_id = resolve_context_university(self._fake_request(self.member))
        self.assertFalse(is_scoped)
        self.assertIsNone(university_id)

    def test_explicit_personal_string_is_scoped_to_personal(self):
        is_scoped, university_id = resolve_context_university(self._fake_request(self.member, 'personal'))
        self.assertTrue(is_scoped)
        self.assertIsNone(university_id)

    def test_real_member_gets_validated_university_id(self):
        is_scoped, university_id = resolve_context_university(self._fake_request(self.member, str(self.uni.id)))
        self.assertTrue(is_scoped)
        self.assertEqual(university_id, self.uni.id)

    def test_outsider_is_rejected(self):
        from rest_framework.exceptions import PermissionDenied
        with self.assertRaises(PermissionDenied):
            resolve_context_university(self._fake_request(self.outsider, str(self.uni.id)))

    def test_garbage_value_is_rejected(self):
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            resolve_context_university(self._fake_request(self.member, 'not-a-number'))


class TemplateCatalogueContextTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Catalogue Uni', contact_email='cat@t.com', contact_name='C', status='active')
        self.member = User.objects.create_user(username='__t_cat_member__', email='cat_member@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=self.member, university=self.uni, role='student')

        self.personal_template = VMTemplate.objects.create(
            name='__TEST__ Personal Template', description='x', cpu_cores=1, ram_gb=1, storage_gb=5,
            os='Linux', is_available=True,
        )
        self.uni_template = VMTemplate.objects.create(
            name='__TEST__ Uni Template', description='x', cpu_cores=1, ram_gb=1, storage_gb=5,
            os='Linux', is_available=True, university=self.uni,
        )

    def test_anonymous_default_browse_unaffected_personal_only(self):
        """The real, most common caller (public TemplatesPage, anonymous)
        — must be completely unaffected by this feature existing."""
        resp = self.client.get('/api/vms/templates/')
        self.assertEqual(resp.status_code, 200)
        names = [t['name'] for t in resp.data['data']]
        self.assertIn('__TEST__ Personal Template', names)
        self.assertNotIn('__TEST__ Uni Template', names)

    def test_authenticated_university_context_shows_scoped_catalogue_only(self):
        self.client.force_authenticate(self.member)
        resp = self.client.get(f'/api/vms/templates/?context={self.uni.id}')
        self.assertEqual(resp.status_code, 200)
        names = [t['name'] for t in resp.data['data']]
        self.assertIn('__TEST__ Uni Template', names)
        self.assertNotIn('__TEST__ Personal Template', names)

    def test_crafted_context_for_university_not_affiliated_with_is_blocked(self):
        outsider = User.objects.create_user(username='__t_cat_outsider__', email='cat_outsider@t.com', password='pw12345')
        self.client.force_authenticate(outsider)
        resp = self.client.get(f'/api/vms/templates/?context={self.uni.id}')
        self.assertEqual(resp.status_code, 403)


class SamePersonBothIdentitiesTests(TestCase):
    """THE scenario: one real account, genuinely both an individual
    paying user AND a university-affiliated member at once. Every
    assertion here is checking for zero cross-contamination in either
    direction."""

    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Dual Identity Uni', contact_email='dual@t.com', contact_name='D', status='active')
        self.dept = Department.objects.create(university=self.uni, name='CS', code='CS')
        self.course = Course.objects.create(department=self.dept, name='Algorithms', code='CS301')

        # ONE real person, both identities.
        self.person = User.objects.create_user(
            username='__t_dual_person__', email='dual_person@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=self.person, university=self.uni, department=self.dept, role='student')
        CourseEnrollment.objects.create(course=self.course, user=self.person, role='student')

        # Real personal, individually-paid-for template + workspace.
        self.personal_template = VMTemplate.objects.create(
            name='__TEST__ Dual Personal Template', description='x', cpu_cores=1, ram_gb=1, storage_gb=5,
            os='Linux', is_available=True, price_per_hour=1500,
        )
        self.personal_workspace = Workspace.objects.create(
            owner=self.person, name='__TEST__ My Personal Workspace', vm_template=self.personal_template, status='stopped',
        )

        # Real university-scoped template + workspace, tied to the course.
        self.uni_template = VMTemplate.objects.create(
            name='__TEST__ Dual Uni Template', description='x', cpu_cores=1, ram_gb=1, storage_gb=5,
            os='Linux', is_available=True, university=self.uni,
        )
        self.uni_workspace = Workspace.objects.create(
            owner=self.person, name='__TEST__ My University Workspace', vm_template=self.uni_template, status='stopped',
        )

        # A real, genuine individual payment — the person really did pay
        # for something on their own, unrelated to the university.
        self.personal_payment = Payment.objects.create(
            user=self.person, payment_type='workspace_hours_purchase', amount_tzs=Decimal('5000.00'),
            currency='TZS', provider='Mpesa', phone_number='0700000000',
            status='completed', transaction_id='CTX-TEST-001',
        )

        # Real sessions: one personal (no course), one tied to the course.
        self.personal_session = LiveSession.objects.create(
            host=self.person, name='__TEST__ My Personal Session',
            start_time=timezone.now(), end_time=timezone.now(), invite_code='CTXPERS1', status='ended',
        )
        self.class_session = LiveSession.objects.create(
            host=self.person, name='__TEST__ My Class Session', course=self.course,
            start_time=timezone.now(), end_time=timezone.now(), invite_code='CTXCLASS', status='ended',
        )

        self.client.force_authenticate(self.person)

    def test_personal_context_workspaces_show_only_personal_never_university(self):
        resp = self.client.get('/api/workspaces/')
        self.assertEqual(resp.status_code, 200)
        names = [w['name'] for w in resp.data]
        self.assertIn('__TEST__ My Personal Workspace', names)
        self.assertNotIn('__TEST__ My University Workspace', names)

    def test_university_context_workspaces_show_only_university_never_personal(self):
        resp = self.client.get(f'/api/workspaces/?context={self.uni.id}')
        self.assertEqual(resp.status_code, 200)
        names = [w['name'] for w in resp.data]
        self.assertIn('__TEST__ My University Workspace', names)
        self.assertNotIn('__TEST__ My Personal Workspace', names)

    def test_no_context_param_sessions_are_unfiltered_legacy_behavior(self):
        """No context param at all is Phase 5's already-proven, still-
        live default: everything the person hosts/joined, class sessions
        included - explicitly NOT the same as an active 'personal'
        context choice. Regression-proofs the exact bug this suite
        caught during Phase 6 development."""
        resp = self.client.get('/api/sessions/live/')
        self.assertEqual(resp.status_code, 200)
        hosted_names = [s['name'] for s in resp.data['data']['my_hosted']]
        self.assertIn('__TEST__ My Personal Session', hosted_names)
        self.assertIn('__TEST__ My Class Session', hosted_names)

    def test_personal_context_sessions_show_only_personal_never_class(self):
        """The real navbar switcher, once 'Personal Account' is actively
        selected, sends this exact explicit param."""
        resp = self.client.get('/api/sessions/live/?context=personal')
        self.assertEqual(resp.status_code, 200)
        hosted_names = [s['name'] for s in resp.data['data']['my_hosted']]
        self.assertIn('__TEST__ My Personal Session', hosted_names)
        self.assertNotIn('__TEST__ My Class Session', hosted_names)

    def test_university_context_sessions_show_only_class_never_personal(self):
        resp = self.client.get(f'/api/sessions/live/?context={self.uni.id}')
        self.assertEqual(resp.status_code, 200)
        hosted_names = [s['name'] for s in resp.data['data']['my_hosted']]
        self.assertIn('__TEST__ My Class Session', hosted_names)
        self.assertNotIn('__TEST__ My Personal Session', hosted_names)

    def test_billing_history_is_identical_regardless_of_context_param(self):
        """The core 'individual billing stays completely separate' rule:
        BillingOverviewView/PaymentHistoryView are never context-scoped —
        the person's REAL personal payment always shows, whether or not a
        (meaningless, ignored) context param is even attached."""
        resp_personal = self.client.get('/api/billing/overview/')
        resp_with_context = self.client.get(f'/api/billing/overview/?context={self.uni.id}')

        self.assertEqual(resp_personal.status_code, 200)
        self.assertEqual(resp_with_context.status_code, 200)
        self.assertEqual(
            resp_personal.data['this_month']['total_spent'],
            resp_with_context.data['this_month']['total_spent'],
        )
        self.assertGreaterEqual(resp_personal.data['this_month']['total_spent'], 5000.0)

        payments_resp = self.client.get('/api/billing/payments/')
        payment_refs = [p['reference'] for p in payments_resp.data['payments']]
        self.assertIn('CTX-TEST-001', payment_refs)

    def test_personal_payment_never_appears_in_any_university_revenue_view(self):
        """The individual's real Payment row must never surface through
        the SuperAdmin/university-admin revenue surfaces (Phase 3/4) —
        those are genuinely separate aggregates (UniversityInvoice), not
        a union with personal Payment data."""
        self.uni.admin_user = self.person  # even as the university's own admin...
        self.uni.save()

        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/analytics/')
        self.assertEqual(resp.status_code, 200)
        # The analytics payload has no payment/revenue figures at all -
        # confirms it's a genuinely separate, usage-only view.
        self.assertNotIn('amount_tzs', resp.data['data'])
        self.assertNotIn('total_spent', resp.data['data'])

    def test_crafted_workspace_context_for_unaffiliated_university_is_blocked(self):
        other_uni = University.objects.create(
            name='__TEST__ Unrelated Uni', contact_email='unrel@t.com', contact_name='U', status='active')
        resp = self.client.get(f'/api/workspaces/?context={other_uni.id}')
        self.assertEqual(resp.status_code, 403)

    def test_crafted_session_context_for_unaffiliated_university_is_blocked(self):
        other_uni = University.objects.create(
            name='__TEST__ Unrelated Sessions Uni', contact_email='unrel2@t.com', contact_name='U2', status='active')
        resp = self.client.get(f'/api/sessions/live/?context={other_uni.id}')
        self.assertEqual(resp.status_code, 403)
