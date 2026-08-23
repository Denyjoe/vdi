"""
Phase 1 (Premium Rebuild) — Template Library & Assignment.

A real university-scoped template can now be browsed as a library and
assigned directly to a course (no new build cycle when one already
exists), reusing the exact CourseDetailView.patch() write path that
already existed for default_template_id — just now validated against
cross-tenant leakage, and surfaced via a real GET view for browsing.

The quota-accounting question this phase explicitly asked to verify:
does assigning the SAME template to multiple courses inflate the
university's real hardware usage? Verified below against the real
get_university_resource_usage() — it only ever iterates real VMTemplate
rows (once each, regardless of how many courses point at one) and real
running VirtualMachine rows (once per genuinely running machine) — it
never iterates Course at all, so per-course-assignment double-counting
is structurally impossible, not just "currently doesn't happen".
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.university.models import University, Department, Course
from apps.university.services.quota_service import get_university_resource_usage


def _make_active_university(admin_user, **overrides):
    defaults = dict(
        name='__TEST__ Template Library Uni', contact_email='c@t.com', contact_name='C',
        status='active', admin_user=admin_user,
        max_vcpu_cores=64, max_ram_gb=256, max_storage_gb=2000,
    )
    defaults.update(overrides)
    return University.objects.create(**defaults)


class UniversityTemplateLibraryViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni_admin = User.objects.create_user(username='__t_lib_admin__', email='lib_admin@t.com', password='pw12345')
        self.other_admin = User.objects.create_user(username='__t_lib_other__', email='lib_other@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin, name='__TEST__ Library Uni')
        self.other_uni = _make_active_university(self.other_admin, name='__TEST__ Library Other Uni')
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='LIB')

        from apps.vms.models import VMTemplate
        self.template = VMTemplate.objects.create(
            name='__TEST__ CAD Workstation', description='x', cpu_cores=4, ram_gb=8, storage_gb=40,
            os='Ubuntu 22.04', os_family='ubuntu', university=self.uni, price_per_hour='500.00',
        )
        # A platform-wide (non-university) template must never leak in here.
        self.personal_template = VMTemplate.objects.create(
            name='__TEST__ Personal Template', description='x', cpu_cores=2, ram_gb=4, storage_gb=20, os='Ubuntu',
        )

    def tearDown(self):
        self.template.delete()
        self.personal_template.delete()
        University.objects.filter(id__in=[self.uni.id, self.other_uni.id]).delete()

    def test_library_lists_only_this_universitys_real_templates(self):
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/templates/')
        self.assertEqual(resp.status_code, 200)
        ids = [t['id'] for t in resp.data['data']]
        self.assertEqual(ids, [self.template.id])
        self.assertNotIn(self.personal_template.id, ids)

    def test_library_shows_real_courses_currently_assigned(self):
        course_a = Course.objects.create(department=self.dept, name='A', code='LIBA', default_template=self.template)
        course_b = Course.objects.create(department=self.dept, name='B', code='LIBB', default_template=self.template)

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/templates/')
        row = resp.data['data'][0]
        self.assertEqual(row['price_per_hour'], 500.0)
        course_codes = sorted(c['code'] for c in row['courses'])
        self.assertEqual(course_codes, ['LIBA', 'LIBB'])

        course_a.delete()
        course_b.delete()

    def test_admin_x_cannot_view_university_ys_template_library(self):
        self.client.force_authenticate(self.other_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/templates/')
        self.assertEqual(resp.status_code, 403)


class CourseTemplateAssignmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni_admin = User.objects.create_user(username='__t_assign_admin__', email='assign_admin@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin, name='__TEST__ Assignment Uni')
        self.other_uni = _make_active_university(
            User.objects.create_user(username='__t_assign_other__', email='assign_other@t.com', password='pw12345'),
            name='__TEST__ Assignment Other Uni',
        )
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='AS')
        self.course = Course.objects.create(department=self.dept, name='Course', code='AS101')

        from apps.vms.models import VMTemplate
        self.template = VMTemplate.objects.create(
            name='__TEST__ Assign Template', description='x', cpu_cores=2, ram_gb=4, storage_gb=20,
            os='Ubuntu', university=self.uni,
        )
        self.foreign_template = VMTemplate.objects.create(
            name='__TEST__ Foreign Template', description='x', cpu_cores=2, ram_gb=4, storage_gb=20,
            os='Ubuntu', university=self.other_uni,
        )

    def tearDown(self):
        self.template.delete()
        self.foreign_template.delete()
        University.objects.filter(id__in=[self.uni.id, self.other_uni.id]).delete()

    def test_assign_existing_library_template_to_course_succeeds(self):
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.patch(f'/api/university-admin/courses/{self.course.id}/', {
            'default_template_id': self.template.id,
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['data']['default_template_id'], self.template.id)
        self.assertEqual(resp.data['data']['default_template_name'], '__TEST__ Assign Template')
        self.course.refresh_from_db()
        self.assertEqual(self.course.default_template_id, self.template.id)

    def test_cannot_assign_another_universitys_template_real_cross_tenant_block(self):
        """The real security gap fixed this phase — previously no
        validation existed at all on this write path."""
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.patch(f'/api/university-admin/courses/{self.course.id}/', {
            'default_template_id': self.foreign_template.id,
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.course.refresh_from_db()
        self.assertIsNone(self.course.default_template_id)

    def test_clearing_assignment_with_null_works(self):
        self.course.default_template = self.template
        self.course.save()
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.patch(f'/api/university-admin/courses/{self.course.id}/', {
            'default_template_id': None,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.course.refresh_from_db()
        self.assertIsNone(self.course.default_template_id)

    def test_assign_same_template_to_second_course_both_reflect_it(self):
        course_b = Course.objects.create(department=self.dept, name='B', code='AS102')
        self.client.force_authenticate(self.uni_admin)

        self.client.patch(f'/api/university-admin/courses/{self.course.id}/', {'default_template_id': self.template.id}, format='json')
        self.client.patch(f'/api/university-admin/courses/{course_b.id}/', {'default_template_id': self.template.id}, format='json')

        self.course.refresh_from_db()
        course_b.refresh_from_db()
        self.assertEqual(self.course.default_template_id, self.template.id)
        self.assertEqual(course_b.default_template_id, self.template.id)

        lib_resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/templates/')
        row = next(t for t in lib_resp.data['data'] if t['id'] == self.template.id)
        self.assertEqual(sorted(c['code'] for c in row['courses']), ['AS101', 'AS102'])

        course_b.delete()


class SharedTemplateQuotaAccountingTests(TestCase):
    """The exact real question this phase asked to verify: when the
    SAME template is assigned to two different courses, is quota
    consumption counted once per real, actually-running VM — never
    inflated by how many courses happen to point at that template?"""

    def setUp(self):
        self.uni_admin = User.objects.create_user(username='__t_quota_admin__', email='quota_admin@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin, name='__TEST__ Shared Quota Uni')
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='SQ')

        from apps.vms.models import VMTemplate
        self.template = VMTemplate.objects.create(
            name='__TEST__ Shared Template', description='x', cpu_cores=4, ram_gb=8, storage_gb=40,
            os='Ubuntu', university=self.uni,
        )
        self.owner = User.objects.create_user(username='__t_quota_owner__', email='quota_owner@t.com', password='pw12345')

    def tearDown(self):
        self.template.delete()
        University.objects.filter(id=self.uni.id).delete()

    def test_template_shared_by_two_courses_still_counts_once_in_static_usage(self):
        course_a = Course.objects.create(department=self.dept, name='A', code='SQA', default_template=self.template)
        course_b = Course.objects.create(department=self.dept, name='B', code='SQB', default_template=self.template)

        usage = get_university_resource_usage(self.uni)
        # ONE real VMTemplate row → counted once, regardless of 2 real
        # course assignments pointing at it.
        self.assertEqual(usage['vcpu_used'], 4)
        self.assertEqual(usage['ram_gb_used'], 8)
        self.assertEqual(usage['storage_gb_used'], 40)
        self.assertEqual(len(usage['templates']), 1)

        course_a.delete()
        course_b.delete()

    def test_two_real_running_vms_from_the_shared_template_count_as_two_not_inflated_by_course_count(self):
        """Two REAL running VMs (one per real session/workspace launch)
        against a template shared by two courses must count as exactly
        2 real running instances — not 2x that because 2 courses
        happen to share the template, and not 1x (deduplicated) either
        — each real VM is real, separate hardware load."""
        Course.objects.create(department=self.dept, name='A', code='SQA2', default_template=self.template)
        Course.objects.create(department=self.dept, name='B', code='SQB2', default_template=self.template)

        from apps.vms.models import VirtualMachine
        vm1 = VirtualMachine.objects.create(
            name='__TEST__ Shared VM 1', owner=self.owner, template=self.template, status='running', proxmox_vm_id=None,
        )
        vm2 = VirtualMachine.objects.create(
            name='__TEST__ Shared VM 2', owner=self.owner, template=self.template, status='running', proxmox_vm_id=None,
        )

        usage = get_university_resource_usage(self.uni)
        # Static (4) + 2 real running clones of the SAME template (4 each) = 12.
        # If course-assignment count leaked into this math it would be
        # inflated well past 12 (e.g. double-counted per course = 20+).
        self.assertEqual(usage['vcpu_used'], 12)
        self.assertEqual(usage['ram_gb_used'], 24)
        self.assertEqual(usage['storage_gb_used'], 120)
        self.assertEqual(len(usage['running_vms']), 2)

        vm1.delete()
        vm2.delete()

    def test_check_quota_allows_uses_the_same_non_inflated_math(self):
        """The real pre-flight check used at both real enforcement
        points (workspace launch, template creation) must reflect the
        same honest, non-inflated usage."""
        Course.objects.create(department=self.dept, name='A', code='SQA3', default_template=self.template)
        Course.objects.create(department=self.dept, name='B', code='SQB3', default_template=self.template)

        from apps.university.services.quota_service import check_quota_allows
        # max_vcpu_cores=64, static usage=4 → room for 60 more, regardless
        # of the template being shared by 2 courses.
        allowed, message = check_quota_allows(self.uni, additional_vcpu=60)
        self.assertTrue(allowed, message)
        allowed, message = check_quota_allows(self.uni, additional_vcpu=61)
        self.assertFalse(allowed)
