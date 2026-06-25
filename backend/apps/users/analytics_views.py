import datetime
from django.utils import timezone
from django.db.models import Count, Sum, F, Avg, Q
from django.db.models.functions import TruncDate
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.users.permissions import IsAdmin
from apps.users.models import User, ActivityLog
from apps.vms.models import VirtualMachine, VMTemplate
from apps.sessions.models import RemoteSession, ExamSession
from apps.classes.models import Class, ClassEnrollment
from apps.assignments.models import Assignment, Submission

class AdminAnalyticsOverview(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        now = timezone.now()
        week_ago = now - datetime.timedelta(days=7)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Users
        users = User.objects.all()
        total_users = users.count()
        students = users.filter(role='student').count()
        lecturers = users.filter(role='lecturer').count()
        admins = users.filter(role='admin').count()
        new_this_week = users.filter(created_at__gte=week_ago).count()

        # VMs
        vms = VirtualMachine.objects.exclude(status='deleted')
        total_vms = vms.count()
        running_vms = vms.filter(status='running').count()
        stopped_vms = vms.filter(status='stopped').count()
        provisioning_vms = vms.filter(status='provisioning').count()
        
        templates = VMTemplate.objects.all()
        total_templates = templates.count()
        
        most_popular_template = None
        if total_vms > 0:
            top_template = templates.annotate(vm_count=Count('instances')).order_by('-vm_count').first()
            if top_template:
                most_popular_template = top_template.name

        # Sessions
        sessions = RemoteSession.objects.all()
        total_sessions = sessions.count()
        active_sessions = sessions.filter(status='active').count()
        sessions_today = sessions.filter(started_at__gte=today_start).count()
        sessions_this_week = sessions.filter(started_at__gte=week_ago).count()
        
        ended_sessions = sessions.filter(status__in=['disconnected', 'terminated'], duration_seconds__gt=0)
        avg_duration_sec = ended_sessions.aggregate(Avg('duration_seconds'))['duration_seconds__avg'] or 0
        avg_duration_minutes = round(avg_duration_sec / 60.0, 1)

        # Assignments
        assignments = Assignment.objects.all()
        total_assignments = assignments.count()
        active_assignments = assignments.filter(is_active=True).count()
        
        submissions = Submission.objects.all()
        total_submissions = submissions.count()
        late_submissions = submissions.filter(is_late=True).count()
        
        # Calculate submission rate
        # total_submissions / (total assignments * enrolled students) * 100
        # Actually a better way: sum of enrolled students for all assignments
        total_possible_submissions = 0
        for assignment in assignments:
            total_possible_submissions += assignment.class_room.enrollments.count()
            
        submission_rate = 0
        if total_possible_submissions > 0:
            submission_rate = round((total_submissions / total_possible_submissions) * 100, 1)

        # Exams
        exams = ExamSession.objects.all()
        total_exams = exams.count()
        active_exams = exams.filter(status='active').count()
        ended_exams = exams.filter(status='ended').count()

        # Classes
        total_classes = Class.objects.count()
        total_enrollments = ClassEnrollment.objects.count()

        return Response({
            "success": True,
            "data": {
                "users": {
                    "total": total_users,
                    "students": students,
                    "lecturers": lecturers,
                    "admins": admins,
                    "new_this_week": new_this_week
                },
                "vms": {
                    "total": total_vms,
                    "running": running_vms,
                    "stopped": stopped_vms,
                    "provisioning": provisioning_vms,
                    "total_templates": total_templates,
                    "most_popular_template": most_popular_template
                },
                "sessions": {
                    "total": total_sessions,
                    "active": active_sessions,
                    "today": sessions_today,
                    "this_week": sessions_this_week,
                    "avg_duration_minutes": avg_duration_minutes
                },
                "assignments": {
                    "total": total_assignments,
                    "active": active_assignments,
                    "total_submissions": total_submissions,
                    "late_submissions": late_submissions,
                    "submission_rate": submission_rate
                },
                "exams": {
                    "total": total_exams,
                    "active": active_exams,
                    "ended": ended_exams
                },
                "classes": {
                    "total": total_classes,
                    "total_enrollments": total_enrollments
                }
            }
        })


class AdminSessionTrends(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        now = timezone.now()
        fourteen_days_ago = now - datetime.timedelta(days=14)
        
        # Get actual data from DB
        daily_stats = RemoteSession.objects.filter(
            started_at__gte=fourteen_days_ago
        ).annotate(
            date=TruncDate('started_at')
        ).values('date').annotate(
            sessions=Count('id'),
            unique_users=Count('user', distinct=True)
        ).order_by('date')
        
        # Convert DB data to a dict for easy lookup
        stats_dict = {item['date'].strftime('%Y-%m-%d'): item for item in daily_stats}
        
        # Generate all 14 days and fill in missing days with 0
        result = []
        for i in range(14, -1, -1):
            date_obj = now.date() - datetime.timedelta(days=i)
            date_str = date_obj.strftime('%Y-%m-%d')
            day_str = date_obj.strftime('%a')
            
            if date_str in stats_dict:
                result.append({
                    "date": date_str,
                    "day": day_str,
                    "sessions": stats_dict[date_str]['sessions'],
                    "unique_users": stats_dict[date_str]['unique_users']
                })
            else:
                result.append({
                    "date": date_str,
                    "day": day_str,
                    "sessions": 0,
                    "unique_users": 0
                })
                
        return Response({
            "success": True,
            "data": result
        })


class AdminVMUsageStats(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # By Template
        vms = VirtualMachine.objects.all()
        total_vms = vms.count()
        
        by_template = []
        templates = VMTemplate.objects.all()
        for template in templates:
            template_vms = vms.filter(template=template)
            vm_count = template_vms.count()
            
            if total_vms > 0 and vm_count > 0:
                active_count = template_vms.filter(status='running').count()
                
                # Get all sessions for VMs of this template
                sessions = RemoteSession.objects.filter(vm__template=template)
                total_duration_sec = sessions.aggregate(Sum('duration_seconds'))['duration_seconds__sum'] or 0
                total_session_hours = round(total_duration_sec / 3600.0, 1)
                
                percentage = round((vm_count / total_vms) * 100, 1)
                
                by_template.append({
                    "template_name": template.name,
                    "vm_count": vm_count,
                    "active_count": active_count,
                    "total_session_hours": total_session_hours,
                    "percentage": percentage
                })
                
        # By Status
        by_status = {
            "running": vms.filter(status='running').count(),
            "stopped": vms.filter(status='stopped').count(),
            "provisioning": vms.filter(status='provisioning').count(),
            "deleted": vms.filter(status='deleted').count()
        }
        
        # Top Users
        students = User.objects.filter(role='student').annotate(
            vm_count=Count('virtual_machines')
        ).order_by('-vm_count')[:5]
        
        top_users = []
        for student in students:
            sessions = RemoteSession.objects.filter(user=student)
            total_duration_sec = sessions.aggregate(Sum('duration_seconds'))['duration_seconds__sum'] or 0
            total_session_hours = round(total_duration_sec / 3600.0, 1)
            
            top_users.append({
                "name": f"{student.first_name} {student.last_name}".strip() or student.username,
                "email": student.email,
                "vm_count": student.vm_count,
                "total_session_hours": total_session_hours
            })
            
        return Response({
            "success": True,
            "data": {
                "by_template": by_template,
                "by_status": by_status,
                "top_users": top_users
            }
        })


class AdminActivityStats(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # Recent logs
        recent_logs_qs = ActivityLog.objects.select_related('user').order_by('-timestamp')[:10]
        recent_logs = []
        for log in recent_logs_qs:
            recent_logs.append({
                "id": log.id,
                "user_email": log.user.email if log.user else "System",
                "action": log.action,
                "description": log.description,
                "timestamp": log.timestamp
            })
            
        # Actions breakdown
        thirty_days_ago = timezone.now() - datetime.timedelta(days=30)
        actions_qs = ActivityLog.objects.filter(timestamp__gte=thirty_days_ago).values('action').annotate(
            count=Count('id')
        ).order_by('-count')
        
        actions_breakdown = list(actions_qs)
        
        # Peak hours
        # Extract hour from started_at for sessions
        # For simplicity across DBs, we'll fetch the last N sessions and group in Python
        recent_sessions = RemoteSession.objects.all().order_by('-started_at')[:1000]
        
        hour_counts = {i: 0 for i in range(24)}
        for session in recent_sessions:
            # Use local time for hour grouping
            local_time = timezone.localtime(session.started_at)
            hour_counts[local_time.hour] += 1
            
        peak_hours = []
        for hour in range(24):
            label = "12 AM" if hour == 0 else "12 PM" if hour == 12 else f"{hour} AM" if hour < 12 else f"{hour - 12} PM"
            peak_hours.append({
                "hour": hour,
                "label": label,
                "sessions": hour_counts[hour]
            })
            
        return Response({
            "success": True,
            "data": {
                "recent_logs": recent_logs,
                "actions_breakdown": actions_breakdown,
                "peak_hours": peak_hours
            }
        })


class AdminAssignmentStats(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # Assignments by class
        classes = Class.objects.all()
        assignments_by_class = []
        
        for cls in classes:
            class_assignments = Assignment.objects.filter(class_room=cls)
            total_assignments = class_assignments.count()
            
            if total_assignments > 0:
                class_submissions = Submission.objects.filter(assignment__in=class_assignments)
                total_submissions = class_submissions.count()
                late_submissions = class_submissions.filter(is_late=True).count()
                on_time_submissions = total_submissions - late_submissions
                
                enrolled = cls.enrollments.count()
                total_possible = total_assignments * enrolled
                
                submission_rate = 0
                if total_possible > 0:
                    submission_rate = round((total_submissions / total_possible) * 100, 1)
                    
                assignments_by_class.append({
                    "class_name": cls.name,
                    "total_assignments": total_assignments,
                    "total_submissions": total_submissions,
                    "late_submissions": late_submissions,
                    "on_time_submissions": on_time_submissions,
                    "submission_rate": submission_rate
                })
                
        # Recent submissions
        recent_subs_qs = Submission.objects.select_related('student', 'assignment').order_by('-submitted_at')[:5]
        recent_submissions = []
        for sub in recent_subs_qs:
            student_name = f"{sub.student.first_name} {sub.student.last_name}".strip() or sub.student.username
            recent_submissions.append({
                "id": sub.id,
                "student_name": student_name,
                "assignment_title": sub.assignment.title,
                "submitted_at": sub.submitted_at,
                "is_late": sub.is_late
            })
            
        return Response({
            "success": True,
            "data": {
                "assignments_by_class": assignments_by_class,
                "recent_submissions": recent_submissions
            }
        })
