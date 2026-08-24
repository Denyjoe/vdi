"""
Phase 3 — Platform Owner (SuperAdmin) management layer.

Two trust zones in this file:
  - UniversityAccessRequestView: public, unauthenticated — anyone can
    submit a request. It only ever creates a University row in
    status='pending'; no login, no access, no seats are granted.
  - Everything else: gated by IsSuperAdmin (apps.university.permissions),
    which reuses Django's own is_superuser — the real platform owner
    only. Regular platform admins (role='admin') do NOT pass this check;
    that separation is proven in Phase 2's SuperAdminBoundaryTests and
    re-proven live in this phase's report.

Reuses, not duplicates: the existing Payment/User models for admin_user
lookup, the existing AdminActionLog audit trail via log_admin_action,
and the same Sum-aggregate breakdown shape as apps.users.analytics_views
.RevenueBreakdownView — kept as a separate endpoint (not merged into
that one) so individual-user revenue reporting is never silently mixed
with university-contract revenue.
"""
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.admin_services import log_admin_action
from .models import University, UniversityInvoice, UniversityAffiliation
from .permissions import IsSuperAdmin


def _university_summary(u):
    return {
        'id': u.id,
        'name': u.name,
        'logo': u.logo.url if u.logo else None,
        'contact_email': u.contact_email,
        'contact_name': u.contact_name,
        'description': u.description,
        'status': u.status,
        'rejection_reason': u.rejection_reason,
        'admin_user_id': u.admin_user_id,
        'admin_user_email': u.admin_user.email if u.admin_user else None,
        'seats_allocated': u.seats_allocated,
        'price_per_seat_tzs': float(u.price_per_seat_tzs) if u.price_per_seat_tzs is not None else None,
        'billing_cycle': u.billing_cycle,
        'requested_vcpu_cores': u.requested_vcpu_cores,
        'requested_ram_gb': u.requested_ram_gb,
        'requested_storage_gb': u.requested_storage_gb,
        'max_vcpu_cores': u.max_vcpu_cores,
        'max_ram_gb': u.max_ram_gb,
        'max_storage_gb': u.max_storage_gb,
        'approved_by': u.approved_by.email if u.approved_by else None,
        'approved_at': u.approved_at,
        'department_count': u.departments.count(),
        'created_at': u.created_at,
    }


class UniversityAccessRequestView(APIView):
    """Public — the 'Request University Access' form. No auth required."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        contact_email = (request.data.get('contact_email') or '').strip()
        contact_name = (request.data.get('contact_name') or '').strip()
        description = (request.data.get('description') or '').strip()

        if not name or not contact_email or not contact_name:
            return Response({
                'success': False,
                'message': 'name, contact_email, and contact_name are required.',
            }, status=400)

        def _positive_int_or_none(raw):
            try:
                val = int(raw)
                return val if val > 0 else None
            except (TypeError, ValueError):
                return None

        university = University.objects.create(
            name=name,
            contact_email=contact_email,
            contact_name=contact_name,
            description=description,
            status='pending',
            requested_vcpu_cores=_positive_int_or_none(request.data.get('requested_vcpu_cores')),
            requested_ram_gb=_positive_int_or_none(request.data.get('requested_ram_gb')),
            requested_storage_gb=_positive_int_or_none(request.data.get('requested_storage_gb')),
        )
        return Response({
            'success': True,
            'message': 'Request submitted. Our team will review it shortly.',
            'data': {'id': university.id, 'status': university.status},
        }, status=201)


class SuperAdminUniversityListView(APIView):
    """SuperAdmin only — every University regardless of status, optionally
    filtered by ?status=pending|active|suspended|rejected."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        qs = University.objects.all()
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response({
            'success': True,
            'data': [_university_summary(u) for u in qs],
        })


class SuperAdminUniversityApproveView(APIView):
    """SuperAdmin only — approve a pending (or previously rejected)
    request with real, negotiated terms, and designate its admin user.

    The designated admin must already be a real, registered Ospace
    account (looked up by email) — reusing the existing Firebase auth
    system rather than inventing a separate invite/email pipeline that
    doesn't exist anywhere else in this codebase. If no such account
    exists yet, this returns a clear 400 telling the SuperAdmin the
    person needs to sign up first (existing Google/GitHub auth), which
    keeps this a real, testable flow rather than a fake email that
    would never actually send.
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        from apps.users.models import User

        try:
            university = University.objects.get(pk=pk)
        except University.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        if university.status == 'active':
            return Response({'success': False, 'message': 'Already active.'}, status=400)

        admin_email = (request.data.get('admin_user_email') or '').strip()
        if not admin_email:
            return Response({'success': False, 'message': 'admin_user_email is required.'}, status=400)

        admin_user = User.objects.filter(email__iexact=admin_email).first()
        if not admin_user:
            return Response({
                'success': False,
                'message': (
                    f'No existing Ospace account found for {admin_email}. '
                    'They must sign up (Google/GitHub) first, then re-submit approval.'
                ),
            }, status=400)

        try:
            seats_allocated = int(request.data.get('seats_allocated'))
            if seats_allocated < 1:
                raise ValueError
        except (TypeError, ValueError):
            return Response({'success': False, 'message': 'seats_allocated must be a positive integer.'}, status=400)

        try:
            price_per_seat_tzs = Decimal(str(request.data.get('price_per_seat_tzs')))
            if price_per_seat_tzs < 0:
                raise InvalidOperation
        except (TypeError, InvalidOperation):
            return Response({'success': False, 'message': 'price_per_seat_tzs must be a non-negative number.'}, status=400)

        billing_cycle = request.data.get('billing_cycle', 'semester')
        if billing_cycle not in dict(University.BILLING_CYCLE_CHOICES):
            return Response({'success': False, 'message': 'Invalid billing_cycle.'}, status=400)

        # Real, approved hardware ceiling — a genuine negotiation, so this
        # deliberately does NOT default to whatever was requested on the
        # public form; the SuperAdmin must set it explicitly.
        try:
            max_vcpu_cores = int(request.data.get('max_vcpu_cores'))
            max_ram_gb = int(request.data.get('max_ram_gb'))
            max_storage_gb = int(request.data.get('max_storage_gb'))
            if max_vcpu_cores < 1 or max_ram_gb < 1 or max_storage_gb < 1:
                raise ValueError
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'message': 'max_vcpu_cores, max_ram_gb, and max_storage_gb must all be positive integers.',
            }, status=400)

        university.admin_user = admin_user
        university.seats_allocated = seats_allocated
        university.price_per_seat_tzs = price_per_seat_tzs
        university.billing_cycle = billing_cycle
        university.max_vcpu_cores = max_vcpu_cores
        university.max_ram_gb = max_ram_gb
        university.max_storage_gb = max_storage_gb
        university.status = 'active'
        university.rejection_reason = ''
        university.approved_by = request.user
        university.approved_at = timezone.now()
        university.save()

        # Ensure the designated admin also holds the real affiliation row
        # (get_user_university_role checks admin_user OR this — belt and
        # braces so both lookup paths agree).
        from .models import UniversityAffiliation
        UniversityAffiliation.objects.get_or_create(
            user=admin_user, university=university, department=None, role='admin',
            defaults={'granted_by': request.user},
        )

        log_admin_action(
            request.user, 'university_approved',
            f'Approved "{university.name}": {seats_allocated} seats @ '
            f'{price_per_seat_tzs} TZS/seat ({billing_cycle}), admin={admin_user.email}, '
            f'quota={max_vcpu_cores} vCPU / {max_ram_gb}GB RAM / {max_storage_gb}GB storage',
            target_type='university', target_id=university.id,
        )

        return Response({'success': True, 'data': _university_summary(university)})


class SuperAdminUniversityRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        try:
            university = University.objects.get(pk=pk)
        except University.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'success': False, 'message': 'A real reason is required.'}, status=400)

        university.status = 'rejected'
        university.rejection_reason = reason
        university.save()

        log_admin_action(
            request.user, 'university_rejected',
            f'Rejected "{university.name}": {reason}',
            target_type='university', target_id=university.id,
        )

        return Response({'success': True, 'data': _university_summary(university)})


class SuperAdminUniversitySuspendView(APIView):
    """SuperAdmin only — pause an already-active university. Real, live
    enforcement: apps.university.services.quota_service.check_university_active
    is checked at BOTH real points where a suspended university's users
    would otherwise start consuming new resources (workspace/session
    launch, template creation) — reusing the exact same shared-checker
    pattern proven for hardware quota, not a parallel gate. Existing
    running VMs are left alone; this pauses new activity, it isn't a
    kill switch."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        try:
            university = University.objects.get(pk=pk)
        except University.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        if university.status != 'active':
            return Response({
                'success': False,
                'message': f'Only an active university can be suspended (currently {university.status}).',
            }, status=400)

        reason = (request.data.get('reason') or '').strip()

        university.status = 'suspended'
        university.save()

        log_admin_action(
            request.user, 'university_suspended',
            f'Suspended "{university.name}"' + (f': {reason}' if reason else ''),
            target_type='university', target_id=university.id,
        )

        return Response({'success': True, 'data': _university_summary(university)})


class SuperAdminUniversityReactivateView(APIView):
    """SuperAdmin only — lift a suspension, restoring real launch access
    immediately (the same real check simply passes again next time it's
    evaluated — no separate 'unsuspend' state to keep in sync)."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        try:
            university = University.objects.get(pk=pk)
        except University.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        if university.status != 'suspended':
            return Response({
                'success': False,
                'message': f'Only a suspended university can be reactivated (currently {university.status}).',
            }, status=400)

        university.status = 'active'
        university.save()

        log_admin_action(
            request.user, 'university_reactivated',
            f'Reactivated "{university.name}"',
            target_type='university', target_id=university.id,
        )

        return Response({'success': True, 'data': _university_summary(university)})


class SuperAdminUniversityEditTermsView(APIView):
    """SuperAdmin only — real contract renegotiation after approval:
    seats, price, billing cycle, and/or the approved hardware ceiling.
    Every field is optional (only what's actually being renegotiated is
    sent); each provided field is validated with the SAME rules as the
    original approval, so a partial edit can never leave the university
    in a state the approval flow itself would have rejected."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        try:
            university = University.objects.get(pk=pk)
        except University.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        if university.status not in ('active', 'suspended'):
            return Response({
                'success': False,
                'message': 'Only an approved (active or suspended) university has terms to edit.',
            }, status=400)

        changes = []

        if 'seats_allocated' in request.data:
            try:
                seats_allocated = int(request.data.get('seats_allocated'))
                if seats_allocated < 1:
                    raise ValueError
            except (TypeError, ValueError):
                return Response({'success': False, 'message': 'seats_allocated must be a positive integer.'}, status=400)
            changes.append(f'seats {university.seats_allocated} → {seats_allocated}')
            university.seats_allocated = seats_allocated

        if 'price_per_seat_tzs' in request.data:
            try:
                price_per_seat_tzs = Decimal(str(request.data.get('price_per_seat_tzs')))
                if price_per_seat_tzs < 0:
                    raise InvalidOperation
            except (TypeError, InvalidOperation):
                return Response({'success': False, 'message': 'price_per_seat_tzs must be a non-negative number.'}, status=400)
            changes.append(f'price {university.price_per_seat_tzs} → {price_per_seat_tzs} TZS/seat')
            university.price_per_seat_tzs = price_per_seat_tzs

        if 'billing_cycle' in request.data:
            billing_cycle = request.data.get('billing_cycle')
            if billing_cycle not in dict(University.BILLING_CYCLE_CHOICES):
                return Response({'success': False, 'message': 'Invalid billing_cycle.'}, status=400)
            changes.append(f'billing {university.billing_cycle} → {billing_cycle}')
            university.billing_cycle = billing_cycle

        for field in ('max_vcpu_cores', 'max_ram_gb', 'max_storage_gb'):
            if field in request.data:
                try:
                    value = int(request.data.get(field))
                    if value < 1:
                        raise ValueError
                except (TypeError, ValueError):
                    return Response({'success': False, 'message': f'{field} must be a positive integer.'}, status=400)
                changes.append(f'{field} {getattr(university, field)} → {value}')
                setattr(university, field, value)

        if not changes:
            return Response({'success': False, 'message': 'No real changes were provided.'}, status=400)

        university.save()

        log_admin_action(
            request.user, 'university_terms_updated',
            f'Updated terms for "{university.name}": ' + '; '.join(changes),
            target_type='university', target_id=university.id,
        )

        return Response({'success': True, 'data': _university_summary(university)})


class SuperAdminUniversityDeleteView(APIView):
    """SuperAdmin only — a real, serious, hard-to-reverse action.

    Blocked (409, not 400 — a real, resolvable conflict rather than a
    bad request) if any of the following genuinely exist, matching how
    serious platforms protect against real data loss:
      - any real, active student affiliation with this university
      - any currently-running VM cloned from one of its templates
      - any VMTemplate scoped to it — VMTemplate.university uses
        on_delete=SET_NULL (a template can legitimately outlive a course
        being deleted), so an unblocked delete here would silently turn
        a real, university-scoped Proxmox template into a platform-wide
        one visible to every account — a real security/billing bug, not
        just messy data.
    A genuinely empty university (none of the above) is hard-deleted;
    Department/Course/UniversityAffiliation/DepartmentInvite/
    TemplateRequest/UniversityInvoice all cascade via their own
    on_delete=CASCADE, so no orphaned rows are left behind.

    Requires the caller to type the university's exact real name in
    `confirm_name` — the same typed-confirmation pattern already used
    for real account deletion — so this can never fire from a
    mis-clicked button.
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        try:
            university = University.objects.get(pk=pk)
        except University.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        confirm_name = (request.data.get('confirm_name') or '').strip()
        if confirm_name != university.name:
            return Response({
                'success': False,
                'message': 'Type the university\'s exact name to confirm deletion.',
            }, status=400)

        student_count = UniversityAffiliation.objects.filter(
            university=university, role='student', is_active=True,
        ).values('user_id').distinct().count()
        if student_count:
            return Response({
                'success': False,
                'message': (
                    f'Blocked. {university.name} still has {student_count} real, active student(s). '
                    'Suspend the university instead, or revoke every student affiliation first.'
                ),
            }, status=409)

        from apps.vms.models import VirtualMachine, VMTemplate

        running_vm_count = VirtualMachine.objects.filter(
            template__university=university, status='running',
        ).count()
        if running_vm_count:
            return Response({
                'success': False,
                'message': (
                    f'Blocked. {university.name} has {running_vm_count} real, running VM(s). '
                    'Suspend the university and wait for these to stop, or force-stop them first.'
                ),
            }, status=409)

        template_count = VMTemplate.objects.filter(university=university).count()
        if template_count:
            return Response({
                'success': False,
                'message': (
                    f'Blocked. {university.name} still has {template_count} real template(s) provisioned on '
                    'Proxmox. Delete or reassign those first. Deleting the university would otherwise turn '
                    'them into platform-wide templates visible to everyone.'
                ),
            }, status=409)

        name = university.name
        log_admin_action(
            request.user, 'university_deleted',
            f'Deleted "{name}" (id={university.id}). Genuinely empty, no active students, running VMs, or templates.',
            target_type='university', target_id=university.id,
        )
        university.delete()

        return Response({'success': True, 'message': f'{name} was permanently deleted.'})


# ── Invoices ────────────────────────────────────────────────────────────

def _invoice_summary(inv):
    return {
        'id': inv.id,
        'university_id': inv.university_id,
        'university_name': inv.university.name,
        'amount_tzs': float(inv.amount_tzs),
        'billing_period_start': inv.billing_period_start,
        'billing_period_end': inv.billing_period_end,
        'status': inv.status,
        'due_date': inv.due_date,
        'marked_paid_by': inv.marked_paid_by.email if inv.marked_paid_by else None,
        'paid_at': inv.paid_at,
        'created_at': inv.created_at,
    }


class SuperAdminUniversityInvoiceListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        qs = UniversityInvoice.objects.select_related('university', 'marked_paid_by').all()
        university_id = request.query_params.get('university')
        if university_id:
            qs = qs.filter(university_id=university_id)
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response({'success': True, 'data': [_invoice_summary(i) for i in qs]})

    def post(self, request):
        try:
            university = University.objects.get(pk=request.data.get('university_id'))
        except (University.DoesNotExist, TypeError, ValueError):
            return Response({'success': False, 'message': 'Valid university_id is required.'}, status=400)

        try:
            amount_tzs = Decimal(str(request.data.get('amount_tzs')))
            if amount_tzs <= 0:
                raise InvalidOperation
        except (TypeError, InvalidOperation):
            return Response({'success': False, 'message': 'amount_tzs must be a positive number.'}, status=400)

        period_start = request.data.get('billing_period_start')
        period_end = request.data.get('billing_period_end')
        due_date = request.data.get('due_date')
        if not (period_start and period_end and due_date):
            return Response({
                'success': False,
                'message': 'billing_period_start, billing_period_end, and due_date are required.',
            }, status=400)

        invoice = UniversityInvoice.objects.create(
            university=university,
            amount_tzs=amount_tzs,
            billing_period_start=period_start,
            billing_period_end=period_end,
            due_date=due_date,
            status='pending',
        )

        log_admin_action(
            request.user, 'university_invoice_created',
            f'Created invoice #{invoice.id} for "{university.name}": {amount_tzs} TZS',
            target_type='university_invoice', target_id=invoice.id,
        )

        return Response({'success': True, 'data': _invoice_summary(invoice)}, status=201)


class SuperAdminUniversityInvoiceStatusView(APIView):
    """SuperAdmin only — manually mark an invoice sent/paid/overdue. Real,
    tracked billing (per spec), not an automated payment integration."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        try:
            invoice = UniversityInvoice.objects.get(pk=pk)
        except UniversityInvoice.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        new_status = request.data.get('status')
        if new_status not in dict(UniversityInvoice.STATUS_CHOICES):
            return Response({'success': False, 'message': 'Invalid status.'}, status=400)

        invoice.status = new_status
        if new_status == 'paid':
            invoice.paid_at = timezone.now()
            invoice.marked_paid_by = request.user
        invoice.save()

        log_admin_action(
            request.user, 'university_invoice_status_changed',
            f'Invoice #{invoice.id} ({invoice.university.name}) -> {new_status}',
            target_type='university_invoice', target_id=invoice.id,
        )

        return Response({'success': True, 'data': _invoice_summary(invoice)})


class SuperAdminUniversityRevenueView(APIView):
    """SuperAdmin only — real aggregate revenue from university contracts,
    kept deliberately separate from apps.users.analytics_views
    .RevenueBreakdownView (individual-user revenue) so the two numbers
    are never silently combined. Same Sum-aggregate shape/pattern."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        from django.db.models import Sum

        paid_invoices = UniversityInvoice.objects.filter(status='paid')
        total = float(paid_invoices.aggregate(t=Sum('amount_tzs'))['t'] or 0)

        by_university = [
            {
                'university_id': row['university_id'],
                'university_name': University.objects.get(id=row['university_id']).name,
                'amount_tzs': float(row['total'] or 0),
            }
            for row in paid_invoices.values('university_id').annotate(total=Sum('amount_tzs'))
        ]

        pending_total = float(
            UniversityInvoice.objects.filter(status__in=['pending', 'sent']).aggregate(
                t=Sum('amount_tzs'))['t'] or 0
        )
        overdue_total = float(
            UniversityInvoice.objects.filter(status='overdue').aggregate(t=Sum('amount_tzs'))['t'] or 0
        )

        return Response({
            'success': True,
            'total_paid_tzs': total,
            'pending_tzs': pending_total,
            'overdue_tzs': overdue_total,
            'by_university': by_university,
        })
