import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from apps.classes.models import Class
from apps.sessions.models import ExamSession
from apps.vms.models import VMTemplate
from django.utils import timezone
import datetime

lecturer = User.objects.get(email='shija@dit.ac.tz')
class_room = Class.objects.first()
template = VMTemplate.objects.get(id=1)

exam = ExamSession.objects.create(
  name='Computer Engineering Practical Exam 1',
  class_room=class_room,
  lecturer=lecturer,
  status='scheduled',
  starts_at=timezone.now(),
  ends_at=timezone.now() + datetime.timedelta(hours=2),
  restrict_internet=True,
  restrict_copy_paste=True,
  instructions='Use AutoCAD to complete the floor plan. No internet access permitted.',
  allowed_vm_template=template,
  grace_period_minutes=5
)
print('Exam created:', exam.id, exam.name)
