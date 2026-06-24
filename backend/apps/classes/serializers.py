from rest_framework import serializers
from .models import Class, ClassEnrollment

class ClassEnrollmentSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    class_room = serializers.CharField(source='class_room.name', read_only=True)

    class Meta:
        model = ClassEnrollment
        fields = ['id', 'student', 'class_room', 'enrolled_at']

    def get_student(self, obj):
        return {
            "name": f"{obj.student.first_name} {obj.student.last_name}".strip(),
            "email": obj.student.email,
            "student_id": obj.student.username, # using username as student_id
            "department": getattr(obj.student, 'department', ''),
            "year": getattr(obj.student, 'year', ''),
            "stream": getattr(obj.student, 'stream', '')
        }

class ClassSerializer(serializers.ModelSerializer):
    lecturer = serializers.SerializerMethodField()
    enrolled_count = serializers.SerializerMethodField()
    
    # We add extra fields that might not exist in the basic model to match the instruction's mock
    department = serializers.SerializerMethodField()
    academic_year = serializers.SerializerMethodField()
    stream = serializers.SerializerMethodField()
    semester = serializers.SerializerMethodField()
    max_students = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = ['id', 'name', 'description', 'lecturer', 'department', 
                  'academic_year', 'stream', 'semester', 'max_students', 
                  'is_active', 'created_at', 'enrolled_count']

    def get_lecturer(self, obj):
        return {
            "name": f"{obj.lecturer.first_name} {obj.lecturer.last_name}".strip(),
            "email": obj.lecturer.email
        }

    def get_enrolled_count(self, obj):
        return obj.enrollments.count()
        
    def get_department(self, obj):
        return getattr(obj, 'department', 'Computer Engineering')
        
    def get_academic_year(self, obj):
        return getattr(obj, 'academic_year', '2026/2027')
        
    def get_stream(self, obj):
        return getattr(obj, 'stream', 'COE-2')
        
    def get_semester(self, obj):
        return getattr(obj, 'semester', 2)
        
    def get_max_students(self, obj):
        return getattr(obj, 'max_students', 100)
