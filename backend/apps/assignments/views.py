import os
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Exists, OuterRef
from django.http import FileResponse
from rest_framework import generics, views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.users.permissions import IsLecturer, IsStudent
from apps.classes.models import Class
from apps.sessions.models import ActivityLog
from apps.notifications.services import send_notification

from .models import File, Assignment, Submission
from .serializers import (
    FileSerializer,
    AssignmentSerializer,
    AssignmentCreateSerializer,
    SubmissionSerializer,
    SubmissionCreateSerializer
)

class LecturerFileUploadView(views.APIView):
    permission_classes = [IsLecturer]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        class_room_id = request.data.get('class_room_id')
        title = request.data.get('title')
        description = request.data.get('description', '')
        file_obj = request.FILES.get('file')

        if not all([class_room_id, title, file_obj]):
            return Response({"success": False, "message": "Missing required fields."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            class_room = Class.objects.get(id=class_room_id, lecturer=request.user)
        except Class.DoesNotExist:
            return Response({"success": False, "message": "Class not found or you do not have permission."}, status=status.HTTP_404_NOT_FOUND)

        file_size = file_obj.size

        # Enforce 100 MB maximum upload size.
        MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB in bytes
        if file_size > MAX_UPLOAD_BYTES:
            return Response(
                {"success": False, "message": "File too large. Maximum size is 100MB."},
                status=status.HTTP_400_BAD_REQUEST
            )

        new_file = File.objects.create(
            class_room=class_room,
            uploader=request.user,
            title=title,
            description=description,
            file=file_obj,
            file_size=file_size
        )

        ActivityLog.objects.create(
            user=request.user,
            action='FILE_UPLOADED',
            metadata={"file_id": new_file.id, "class_room_id": class_room.id}
        )

        # Notify students
        from apps.classes.models import ClassEnrollment
        from apps.notifications.services import send_notification
        enrollments = ClassEnrollment.objects.filter(class_room=class_room)
        for e in enrollments:
            send_notification(e.student, 'New Material', 'New Material', f'New material uploaded: {title}', data={'action_url': '/student/materials'})

        serializer = FileSerializer(new_file, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "File uploaded successfully."
        }, status=status.HTTP_201_CREATED)


class ClassFilesListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, class_id):
        try:
            class_room = Class.objects.get(id=class_id)
        except Class.DoesNotExist:
            return Response({"success": False, "message": "Class not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == 'student':
            if not class_room.enrollments.filter(student=request.user).exists():
                return Response({"success": False, "message": "You are not enrolled in this class."}, status=status.HTTP_403_FORBIDDEN)
        elif request.user.role == 'lecturer':
            if class_room.lecturer != request.user:
                return Response({"success": False, "message": "You do not have permission for this class."}, status=status.HTTP_403_FORBIDDEN)
        
        files = class_room.files.all().order_by('-uploaded_at')
        serializer = FileSerializer(files, many=True, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Class files retrieved."
        })


class FileDeleteView(views.APIView):
    permission_classes = [IsLecturer]

    def delete(self, request, file_id):
        try:
            file_record = File.objects.get(id=file_id, uploader=request.user)
        except File.DoesNotExist:
            return Response({"success": False, "message": "File not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        if file_record.file:
            if os.path.isfile(file_record.file.path):
                try:
                    os.remove(file_record.file.path)
                except OSError:
                    pass
        
        file_record.delete()
        return Response({
            "success": True,
            "message": "File deleted successfully."
        })


class LecturerAssignmentListView(views.APIView):
    permission_classes = [IsLecturer]

    def get(self, request):
        assignments = Assignment.objects.filter(lecturer=request.user, is_active=True).order_by('due_date')
        
        class_id = request.query_params.get('class_id')
        if class_id:
            assignments = assignments.filter(class_room_id=class_id)

        serializer = AssignmentSerializer(assignments, many=True, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Assignments retrieved."
        })


class LecturerAssignmentCreateView(views.APIView):
    """
    POST /api/assignments/create/

    Create a new assignment for one of the lecturer's classes.
    Validates that the lecturer owns the class (class_room.lecturer == request.user).

    Permission: IsLecturer
    """
    permission_classes = [IsLecturer]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        """Create a new assignment after validating class ownership."""
        serializer = AssignmentCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # Double-check class ownership (serializer also checks, but belt-and-suspenders)
            class_room = serializer.validated_data.get('class_room')
            if class_room and class_room.lecturer != request.user:
                return Response({
                    "success": False,
                    "message": "You do not have permission to create assignments for this class."
                }, status=status.HTTP_403_FORBIDDEN)

            assignment = serializer.save(lecturer=request.user)

            # Notify students
            from apps.classes.models import ClassEnrollment
            enrollments = ClassEnrollment.objects.filter(class_room=assignment.class_room)
            for e in enrollments:
                send_notification(e.student, 'New Assignment', 'New Assignment', f'New assignment posted: {assignment.title}', data={'action_url': '/student/assignments'})
            
            ActivityLog.objects.create(
                user=request.user,
                action='ASSIGNMENT_CREATED',
                metadata={"assignment_id": assignment.id}
            )

            response_serializer = AssignmentSerializer(assignment, context={'request': request})
            return Response({
                "success": True,
                "data": response_serializer.data,
                "message": "Assignment created successfully."
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "Invalid data provided."
        }, status=status.HTTP_400_BAD_REQUEST)


class LecturerAssignmentDetailView(views.APIView):
    permission_classes = [IsLecturer]

    def get_object(self, pk, user):
        try:
            return Assignment.objects.get(pk=pk, lecturer=user)
        except Assignment.DoesNotExist:
            return None

    def get(self, request, pk):
        assignment = self.get_object(pk, request.user)
        if not assignment:
            return Response({"success": False, "message": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = AssignmentSerializer(assignment, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Assignment retrieved."
        })

    def patch(self, request, pk):
        assignment = self.get_object(pk, request.user)
        if not assignment:
            return Response({"success": False, "message": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AssignmentCreateSerializer(assignment, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            assignment = serializer.save()
            response_serializer = AssignmentSerializer(assignment, context={'request': request})
            return Response({
                "success": True,
                "data": response_serializer.data,
                "message": "Assignment updated successfully."
            })
        
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "Invalid data provided."
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        assignment = self.get_object(pk, request.user)
        if not assignment:
            return Response({"success": False, "message": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

        assignment.is_active = False
        assignment.save()
        return Response({
            "success": True,
            "message": "Assignment deleted successfully."
        })


class StudentAssignmentListView(views.APIView):
    """
    GET /api/assignments/student/

    List assignments for classes the student is enrolled in.
    Enforces strict content isolation: only returns assignments
    from classes where the student has an active ClassEnrollment.

    Permission: IsStudent
    """
    permission_classes = [IsStudent]

    def get(self, request):
        """Return assignments scoped to the student's enrolled classes."""
        from apps.classes.models import ClassEnrollment

        enrolled_class_ids = ClassEnrollment.objects.filter(
            student=request.user
        ).values_list('class_room_id', flat=True)

        assignments = Assignment.objects.filter(
            class_room_id__in=enrolled_class_ids,
            is_active=True
        ).select_related(
            'class_room', 'lecturer'
        ).order_by('due_date')
        
        overdue_filter = request.query_params.get('overdue')
        now = timezone.now()
        
        if overdue_filter == 'true':
            assignments = assignments.filter(due_date__lt=now)
        elif overdue_filter == 'false':
            assignments = assignments.filter(due_date__gte=now)

        has_submitted_subquery = Submission.objects.filter(
            assignment=OuterRef('pk'),
            student=request.user
        )
        
        assignments = assignments.annotate(
            has_submitted=Exists(has_submitted_subquery)
        )

        serializer = AssignmentSerializer(assignments, many=True, context={'request': request})
        data = serializer.data
        
        for idx, assignment in enumerate(assignments):
            data[idx]['has_submitted'] = getattr(assignment, 'has_submitted', False)

        return Response({
            "success": True,
            "data": data,
            "message": "Assignments retrieved."
        })


class StudentSubmitView(views.APIView):
    permission_classes = [IsStudent]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        assignment_id = request.data.get('assignment_id')
        
        try:
            assignment = Assignment.objects.get(id=assignment_id)
        except Assignment.DoesNotExist:
            return Response({"success": False, "message": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)
            
        data = request.data.copy()
        data['assignment'] = assignment.id

        if 'file' in data:
            file_obj = data['file']
            file_obj.name = f"{assignment.id}/{request.user.id}/{file_obj.name}"

        serializer = SubmissionCreateSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            is_late = timezone.now() > assignment.due_date
            submission = serializer.save(student=request.user, is_late=is_late)
            
            ActivityLog.objects.create(
                user=request.user,
                action='ASSIGNMENT_SUBMITTED',
                metadata={"submission_id": submission.id, "is_late": is_late}
            )

            # Notify the lecturer
            from apps.notifications.services import send_notification
            send_notification(
                recipient=assignment.lecturer,
                notification_type='Assignment Submitted',
                title='New Submission',
                message=f"{request.user.first_name} {request.user.last_name} submitted {assignment.title}.",
                data={'action_url': f'/lecturer/classes/{assignment.class_room.id}'}
            )

            response_serializer = SubmissionSerializer(submission, context={'request': request})
            return Response({
                "success": True,
                "data": response_serializer.data,
                "message": "Assignment submitted successfully."
            }, status=status.HTTP_201_CREATED)
            
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "Submission failed."
        }, status=status.HTTP_400_BAD_REQUEST)


class StudentSubmissionsView(views.APIView):
    permission_classes = [IsStudent]

    def get(self, request):
        submissions = Submission.objects.filter(student=request.user).order_by('-submitted_at')
        serializer = SubmissionSerializer(submissions, many=True, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Submissions retrieved."
        })


class LecturerSubmissionsView(views.APIView):
    permission_classes = [IsLecturer]

    def get(self, request, assignment_id):
        try:
            assignment = Assignment.objects.get(id=assignment_id, lecturer=request.user)
        except Assignment.DoesNotExist:
            return Response({"success": False, "message": "Assignment not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        submissions = assignment.submissions.all().order_by('submitted_at')
        serializer = SubmissionSerializer(submissions, many=True, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Submissions retrieved."
        })


class LecturerDownloadSubmissionView(views.APIView):
    permission_classes = [IsLecturer]

    def get(self, request, pk):
        try:
            submission = Submission.objects.get(id=pk, assignment__lecturer=request.user)
        except Submission.DoesNotExist:
            return Response({"success": False, "message": "Submission not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        if not submission.file or not os.path.isfile(submission.file.path):
            return Response({"success": False, "message": "File not found on server."}, status=status.HTTP_404_NOT_FOUND)

        response = FileResponse(open(submission.file.path, 'rb'), as_attachment=True)
        return response
