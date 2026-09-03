"""
Phase 5 — Lecturer Dashboard. Phase 4 (Product Depth Layer) extends this
with real attendance/engagement (derived from the SAME LiveSession/
SessionParticipant/VirtualMachine data, no new tracking model) and a
scoped broadcast reusing the existing notify() mechanism.

"Start Class Session" and recurring scheduling deliberately don't live
here — scheduling reuses the existing CourseDetailView.patch() (already
gated by can_manage_course, now also accepting schedule_day/
schedule_time), and session start reuses PayAndStartSessionView
unchanged in structure, just extended with an optional course_id.
"""
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Course, CourseEnrollment
from .permissions import can_manage_course


def _real_attendance_stats(course):
    """Real per-session and per-student attendance/engagement, derived
    entirely from existing data:
      - "attended" = a real SessionParticipant row for that course's
        LiveSessions (the EXISTING join-tracking, no new model).
      - "duration" = the real, existing VirtualMachine.started_at/
        stopped_at lifecycle timestamps of that participant's own VM —
        the honest signal of how long they were actually connected,
        not just "did a row exist".

    Returns (session_data: list, per_user_stats: {user_id: {...}}).
    """
    from django.utils import timezone
    from apps.sessions.models import LiveSession

    sessions = list(
        LiveSession.objects.filter(course=course).order_by('-start_time')
        .prefetch_related('participants__vm', 'participants__user')
    )

    session_data = []
    per_user = {}

    for s in sessions:
        participants = list(s.participants.all())
        durations = []
        for p in participants:
            entry = per_user.setdefault(p.user_id, {
                'sessions_attended': 0, 'total_minutes': 0.0, 'last_attended': None,
            })
            entry['sessions_attended'] += 1
            if entry['last_attended'] is None or p.joined_at > entry['last_attended']:
                entry['last_attended'] = p.joined_at
            if p.vm_id and p.vm.started_at:
                end = p.vm.stopped_at or timezone.now()
                minutes = max((end - p.vm.started_at).total_seconds() / 60, 0)
                entry['total_minutes'] += minutes
                durations.append(minutes)

        session_data.append({
            'id': s.id, 'name': s.name, 'status': s.status,
            'start_time': s.start_time, 'end_time': s.end_time,
            'participant_count': len(participants),
            'average_duration_minutes': round(sum(durations) / len(durations), 1) if durations else None,
        })

    for entry in per_user.values():
        entry['average_minutes'] = (
            round(entry['total_minutes'] / entry['sessions_attended'], 1) if entry['sessions_attended'] else 0
        )
        entry['total_minutes'] = round(entry['total_minutes'], 1)

    return session_data, per_user


def _active_session_summary(course, user):
    """Phase 2 (Premium Rebuild) — real, live class-session state for
    THIS lecturer's own course, reusing the exact LiveSession model
    HostSessionPage already reads/writes; no parallel tracking. Returns
    None when no real session is currently active, so the dashboard can
    tell "nothing running" from "something running" without guessing."""
    from apps.sessions.models import LiveSession

    session = LiveSession.objects.filter(
        course=course, host=user, status='active',
    ).order_by('-start_time').first()
    if not session:
        return None

    return {
        'id': session.id, 'name': session.name,
        'invite_code': session.invite_code,
        'start_time': session.start_time,
        'scheduled_end_at': session.scheduled_end_at,
        'is_exam_mode': session.is_exam_mode,
        'restrict_internet': session.restrict_internet,
        'restrict_copy_paste': session.restrict_copy_paste,
        'max_participants': session.max_participants,
        'participant_count': session.participants.count(),
    }


class MyCoursesView(APIView):
    """Real courses THIS user is the lecturer for — the literal query,
    not an inference from any other role."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        course_ids = CourseEnrollment.objects.filter(
            user=request.user, role='lecturer',
        ).values_list('course_id', flat=True)
        courses = Course.objects.filter(id__in=course_ids).select_related('department__university')

        return Response({
            'success': True,
            'data': [
                {
                    'id': c.id, 'code': c.code, 'name': c.name,
                    'department_id': c.department_id, 'department_name': c.department.name,
                    'university_id': c.department.university_id, 'university_name': c.department.university.name,
                    'default_template_id': c.default_template_id,
                    'default_restrictions': c.default_restrictions,
                    'schedule_day': c.schedule_day,
                    'schedule_time': c.schedule_time.strftime('%H:%M') if c.schedule_time else None,
                    'student_count': c.enrollments.filter(role='student').count(),
                    'active_session': _active_session_summary(c, request.user),
                }
                for c in courses
            ],
        })


class CourseRosterView(APIView):
    """Real roster: who's enrolled, and — reusing the EXISTING
    LiveSession/SessionParticipant/VirtualMachine data, not a parallel
    attendance system — real join counts AND real connected duration,
    per student."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, course_id):
        try:
            course = Course.objects.select_related('department__university').get(pk=course_id)
        except Course.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)
        if not can_manage_course(request.user, course):
            return Response({'success': False, 'message': 'You do not teach this course.'}, status=403)

        session_data, per_user = _real_attendance_stats(course)

        enrollments = CourseEnrollment.objects.filter(course=course).select_related('user').order_by('role', 'user__email')
        roster = [
            {
                'user_id': e.user_id, 'email': e.user.email,
                'name': f'{e.user.first_name} {e.user.last_name}'.strip() or e.user.email,
                'role': e.role, 'enrolled_at': e.enrolled_at,
                'sessions_attended': per_user.get(e.user_id, {}).get('sessions_attended', 0),
                'average_duration_minutes': per_user.get(e.user_id, {}).get('average_minutes', 0),
                'total_minutes': per_user.get(e.user_id, {}).get('total_minutes', 0),
                'last_attended': per_user.get(e.user_id, {}).get('last_attended'),
            }
            for e in enrollments
        ]

        return Response({
            'success': True,
            'data': {
                'course': {
                    'id': course.id, 'code': course.code, 'name': course.name,
                    'schedule_day': course.schedule_day,
                    'schedule_time': course.schedule_time.strftime('%H:%M') if course.schedule_time else None,
                },
                'roster': roster,
                'sessions': session_data,
                'total_sessions': len(session_data),
            },
        })


class CourseBroadcastView(APIView):
    """Phase 4 — 'message my class roster', reusing the exact same
    notify() call BroadcastMessageView already uses for an active
    session, but targeting the real, full course roster instead —
    genuinely independent of any live session existing at all."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, course_id):
        try:
            course = Course.objects.select_related('department__university').get(pk=course_id)
        except Course.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)
        if not can_manage_course(request.user, course):
            return Response({'success': False, 'message': 'You do not teach this course.'}, status=403)

        message_text = (request.data.get('message') or '').strip()
        if not message_text:
            return Response({'success': False, 'message': 'Message cannot be empty.'}, status=400)

        from apps.notifications.services import notify

        sent_count = 0
        for enrollment in CourseEnrollment.objects.filter(course=course, role='student').select_related('user'):
            try:
                notify(
                    user=enrollment.user,
                    # get_full_name(), not first_name alone -- real bug
                    # found via a live end-to-end test: this lecturer's
                    # first_name is the honorific "Mr." (real last_name
                    # "Shija"), so the notification read "Message from Mr.
                    # (CS101)" -- confirmed live, fixed here and in the
                    # identical pattern in sessions/views.py's broadcast.
                    title=f'Message from {request.user.get_full_name() or request.user.email} ({course.code})',
                    message=message_text,
                    notification_type='direct_message',
                    link='/my-schedule',
                )
                sent_count += 1
            except Exception:
                pass

        return Response({'success': True, 'message': f'Sent to {sent_count} student(s).'})


class MyCourseworkView(APIView):
    """Phase 4 — student-facing: own enrolled courses (with real
    recurring schedule, from whichever real path enrolled them — bulk
    CSV, self-enroll invite link, or a direct grant, all converge on the
    SAME CourseEnrollment row) and own real attendance record, reusing
    _real_attendance_stats scoped to just this student."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        enrollments = CourseEnrollment.objects.filter(
            user=request.user, role='student',
        ).select_related('course__department__university')

        data = []
        for e in enrollments:
            course = e.course
            _sessions, per_user = _real_attendance_stats(course)
            stats = per_user.get(request.user.id, {
                'sessions_attended': 0, 'total_minutes': 0, 'average_minutes': 0, 'last_attended': None,
            })
            data.append({
                'course_id': course.id, 'code': course.code, 'name': course.name,
                'department_name': course.department.name,
                'university_id': course.department.university_id,
                'university_name': course.department.university.name,
                'schedule_day': course.schedule_day,
                'schedule_time': course.schedule_time.strftime('%H:%M') if course.schedule_time else None,
                'sessions_attended': stats['sessions_attended'],
                'average_duration_minutes': stats['average_minutes'],
                'total_minutes': stats['total_minutes'],
                'last_attended': stats['last_attended'],
            })

        return Response({'success': True, 'data': data})
