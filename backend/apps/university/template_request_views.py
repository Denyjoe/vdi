"""
Phase 2 (Product Depth Layer) — Template Request Workflow.

A lecturer requests a new VM template for their course; their real
university admin reviews it and, on approval, is taken directly into
the SAME existing template wizard (apps.vms.template_wizard_views) —
not a parallel build system. On promote, the resulting VMTemplate is
linked back here, auto-assigned to the course, and the lecturer is
notified via the existing notification system.
"""
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Course, TemplateRequest
from .permissions import can_manage_course, can_manage_university


def _request_summary(r):
    return {
        'id': r.id,
        'course_id': r.course_id,
        'course_code': r.course.code,
        'course_name': r.course.name,
        'university_id': r.course.department.university_id,
        'university_name': r.course.department.university.name,
        'requested_by_email': r.requested_by.email,
        'requested_by_name': f'{r.requested_by.first_name} {r.requested_by.last_name}'.strip() or r.requested_by.email,
        'software_needed': r.software_needed,
        'purpose': r.purpose,
        'estimated_vcpu': r.estimated_vcpu,
        'estimated_ram_gb': r.estimated_ram_gb,
        'estimated_storage_gb': r.estimated_storage_gb,
        'status': r.status,
        'admin_notes': r.admin_notes,
        'resulting_template_id': r.resulting_template_id,
        'created_at': r.created_at,
        'reviewed_at': r.reviewed_at,
    }


class LecturerTemplateRequestListCreateView(APIView):
    """GET: this lecturer's own requests (optionally filtered to one
    course). POST: submit a new real request — gated by can_manage_course,
    so only for a course this lecturer genuinely teaches."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        course_id = request.query_params.get('course_id')
        qs = TemplateRequest.objects.filter(requested_by=request.user).select_related(
            'course__department__university',
        )
        if course_id:
            qs = qs.filter(course_id=course_id)
        return Response({'success': True, 'data': [_request_summary(r) for r in qs]})

    def post(self, request):
        try:
            course = Course.objects.select_related('department__university').get(pk=request.data.get('course_id'))
        except (Course.DoesNotExist, TypeError, ValueError):
            return Response({'success': False, 'message': 'Valid course_id is required.'}, status=400)

        if not can_manage_course(request.user, course):
            return Response({'success': False, 'message': 'You do not teach this course.'}, status=403)

        software_needed = (request.data.get('software_needed') or '').strip()
        purpose = (request.data.get('purpose') or '').strip()
        if not software_needed or not purpose:
            return Response({'success': False, 'message': 'software_needed and purpose are required.'}, status=400)

        try:
            estimated_vcpu = int(request.data.get('estimated_vcpu'))
            estimated_ram_gb = int(request.data.get('estimated_ram_gb'))
            estimated_storage_gb = int(request.data.get('estimated_storage_gb'))
            if min(estimated_vcpu, estimated_ram_gb, estimated_storage_gb) < 1:
                raise ValueError
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'message': 'estimated_vcpu, estimated_ram_gb, and estimated_storage_gb must all be positive integers.',
            }, status=400)

        req = TemplateRequest.objects.create(
            course=course, requested_by=request.user,
            software_needed=software_needed, purpose=purpose,
            estimated_vcpu=estimated_vcpu, estimated_ram_gb=estimated_ram_gb,
            estimated_storage_gb=estimated_storage_gb,
        )
        return Response({'success': True, 'data': _request_summary(req)}, status=201)


class TemplateRequestQuotaPreviewView(APIView):
    """Real, honest pre-submit warning — does NOT block submission, just
    tells the lecturer upfront whether their estimated specs would
    currently fit the university's remaining quota."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            course = Course.objects.select_related('department__university').get(
                pk=request.query_params.get('course_id'),
            )
        except (Course.DoesNotExist, TypeError, ValueError):
            return Response({'success': False, 'message': 'Valid course_id is required.'}, status=400)

        if not can_manage_course(request.user, course):
            return Response({'success': False, 'message': 'You do not teach this course.'}, status=403)

        try:
            vcpu = int(request.query_params.get('estimated_vcpu', 0))
            ram_gb = int(request.query_params.get('estimated_ram_gb', 0))
            storage_gb = int(request.query_params.get('estimated_storage_gb', 0))
        except (TypeError, ValueError):
            vcpu = ram_gb = storage_gb = 0

        from .services.quota_service import check_quota_allows
        allowed, message = check_quota_allows(
            course.department.university, additional_vcpu=vcpu,
            additional_ram_gb=ram_gb, additional_storage_gb=storage_gb,
        )
        return Response({'success': True, 'data': {'fits_quota': allowed, 'message': message}})


class UniversityTemplateRequestListView(APIView):
    """University admin's real request queue — every request across
    every course in their university."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, university_id):
        from .models import University
        try:
            university = University.objects.get(pk=university_id)
        except University.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)
        if not can_manage_university(request.user, university):
            return Response({'success': False, 'message': 'Not your university.'}, status=403)

        qs = TemplateRequest.objects.filter(
            course__department__university=university,
        ).select_related('course__department__university', 'requested_by')
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response({'success': True, 'data': [_request_summary(r) for r in qs]})


def _get_managed_request_or_403(user, pk):
    try:
        req = TemplateRequest.objects.select_related('course__department__university').get(pk=pk)
    except TemplateRequest.DoesNotExist:
        return None, Response({'success': False, 'message': 'Not found'}, status=404)
    if not can_manage_university(user, req.course.department.university):
        return None, Response({'success': False, 'message': 'Not your university.'}, status=403)
    return req, None


class TemplateRequestApproveView(APIView):
    """Approve a real, pending request. Also runs the SAME real quota
    pre-check used at actual build time (apps.university.services
    .quota_service.check_quota_allows), so the admin sees an honest
    warning before ever entering the wizard — not a silent failure
    partway through a real Proxmox VM build."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        req, err = _get_managed_request_or_403(request.user, pk)
        if err:
            return err
        if req.status != 'pending':
            return Response({'success': False, 'message': f'Request is already {req.status}.'}, status=400)

        req.status = 'approved'
        req.reviewed_at = timezone.now()
        req.admin_notes = (request.data.get('admin_notes') or '').strip()
        req.save()

        from .services.quota_service import check_quota_allows
        fits_quota, quota_message = check_quota_allows(
            req.course.department.university, additional_vcpu=req.estimated_vcpu,
            additional_ram_gb=req.estimated_ram_gb, additional_storage_gb=req.estimated_storage_gb,
        )

        return Response({
            'success': True,
            'data': _request_summary(req),
            'quota_check': {'fits_quota': fits_quota, 'message': quota_message},
        })


class TemplateRequestRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        req, err = _get_managed_request_or_403(request.user, pk)
        if err:
            return err
        if req.status != 'pending':
            return Response({'success': False, 'message': f'Request is already {req.status}.'}, status=400)

        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'success': False, 'message': 'A real reason is required.'}, status=400)

        req.status = 'rejected'
        req.admin_notes = reason
        req.reviewed_at = timezone.now()
        req.save()

        from apps.notifications.services import notify
        notify(
            user=req.requested_by,
            title='Template Request Rejected',
            message=f'Your request for {req.course.code} ("{req.software_needed[:60]}") was declined: {reason}',
            notification_type='template_request_rejected',
            link='/my-courses',
        )

        return Response({'success': True, 'data': _request_summary(req)})
