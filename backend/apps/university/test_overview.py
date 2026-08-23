"""
Phase 3 (Premium Rebuild) — University Admin Overview.

Every number/series UniversityOverviewView returns is derived from
data that already exists elsewhere (UniversityAffiliation, LiveSession,
VMTemplate, TemplateRequest, quota_service) — no new tracking table, no
synthetic data. Tested here against real, disposable fixtures.
"""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.users.models import User
from apps.university.models import (
    University, Department, Course, UniversityAffiliation, TemplateRequest,
)


def _make_active_university(admin_user, **overrides):
    defaults = dict(
        name='__TEST__ Overview Uni', contact_email='c@t.com', contact_name='C',
        status='active', admin_user=admin_user,
        max_vcpu_cores=32, max_ram_gb=128, max_storage_gb=1000,
    )
    defaults.update(overrides)
    return University.objects.create(**defaults)


class UniversityOverviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni_admin = User.objects.create_user(username='__t_ov_admin__', email='ov_admin@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin)
        self.other_admin = User.objects.create_user(username='__t_ov_other__', email='ov_other@t.com', password='pw12345')
        self.other_uni = _make_active_university(self.other_admin, name='__TEST__ Overview Other Uni')
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='OV')
        self.course = Course.objects.create(department=self.dept, name='Course', code='OV101')

    def tearDown(self):
        University.objects.filter(id__in=[self.uni.id, self.other_uni.id]).delete()

    def test_kpis_reflect_real_counts(self):
        student = User.objects.create_user(username='__t_ov_student__', email='ov_student@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=student, university=self.uni, department=self.dept, role='student')
        lecturer = User.objects.create_user(username='__t_ov_lect__', email='ov_lect@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=lecturer, university=self.uni, department=self.dept, role='lecturer')
        TemplateRequest.objects.create(
            course=self.course, requested_by=lecturer, software_needed='x', purpose='x',
            estimated_vcpu=2, estimated_ram_gb=4, estimated_storage_gb=20, status='pending',
        )

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/overview/')
        self.assertEqual(resp.status_code, 200, resp.data)
        kpis = resp.data['data']['kpis']
        self.assertEqual(kpis['active_student_count'], 1)
        self.assertEqual(kpis['active_lecturer_count'], 1)
        self.assertEqual(kpis['active_course_count'], 1)
        self.assertEqual(kpis['pending_request_count'], 1)
        self.assertEqual(kpis['quota_utilization_pct'], 0.0)

    def test_quota_utilization_reflects_real_committed_template_specs(self):
        from apps.vms.models import VMTemplate
        VMTemplate.objects.create(
            name='__TEST__ Overview Template', description='x', cpu_cores=16, ram_gb=32, storage_gb=100,
            os='Ubuntu', university=self.uni,
        )
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/overview/')
        # 16/32 vCPU = 50% — the real max across the 3 real dimensions.
        self.assertEqual(resp.data['data']['kpis']['quota_utilization_pct'], 50.0)

    def test_enrollment_trend_is_a_real_cumulative_series_of_30_real_days(self):
        student = User.objects.create_user(username='__t_ov_trend__', email='ov_trend@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=student, university=self.uni, department=self.dept, role='student')

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/overview/')
        trend = resp.data['data']['enrollment_trend']
        self.assertEqual(len(trend), 30)
        # The real student created today must show up on today's real point.
        today_str = timezone.now().date().isoformat()
        today_point = next(p for p in trend if p['date'] == today_str)
        self.assertEqual(today_point['students'], 1)
        # Cumulative — every point from today onward is >= any prior point.
        values = [p['students'] for p in trend]
        self.assertEqual(values, sorted(values))

    def test_by_department_reflects_real_students_and_sessions(self):
        student = User.objects.create_user(username='__t_ov_dept__', email='ov_dept@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=student, university=self.uni, department=self.dept, role='student')

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/overview/')
        by_dept = resp.data['data']['by_department']
        self.assertEqual(len(by_dept), 1)
        self.assertEqual(by_dept[0]['department_id'], self.dept.id)
        self.assertEqual(by_dept[0]['student_count'], 1)
        self.assertEqual(by_dept[0]['session_count'], 0)

    def test_quota_trend_is_real_cumulative_vcpu_from_real_template_timestamps(self):
        from apps.vms.models import VMTemplate
        t1 = VMTemplate.objects.create(
            name='__TEST__ Overview T1', description='x', cpu_cores=4, ram_gb=8, storage_gb=40,
            os='Ubuntu', university=self.uni,
        )
        t2 = VMTemplate.objects.create(
            name='__TEST__ Overview T2', description='x', cpu_cores=6, ram_gb=12, storage_gb=60,
            os='Ubuntu', university=self.uni,
        )

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/overview/')
        trend = resp.data['data']['quota_trend']
        self.assertEqual(len(trend), 2)
        # Cumulative: second real template pushes the running total to 10.
        self.assertEqual(trend[0]['vcpu'], 4)
        self.assertEqual(trend[1]['vcpu'], 10)

        t1.delete()
        t2.delete()

    def test_overview_never_leaks_another_universitys_data(self):
        other_dept = Department.objects.create(university=self.other_uni, name='OtherDept', code='OD')
        other_student = User.objects.create_user(username='__t_ov_leak__', email='ov_leak@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=other_student, university=self.other_uni, department=other_dept, role='student')

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/overview/')
        self.assertEqual(resp.data['data']['kpis']['active_student_count'], 0)

    def test_admin_x_cannot_view_university_ys_overview(self):
        self.client.force_authenticate(self.other_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/overview/')
        self.assertEqual(resp.status_code, 403)
