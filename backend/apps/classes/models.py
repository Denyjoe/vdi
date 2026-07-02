from django.db import models
from apps.users.models import User

class Group(models.Model):
  GROUP_TYPE_CHOICES = [
    ('public', 'Public'),
    ('private', 'Private'),
    ('institution', 'Institution'),
  ]

  name = models.CharField(max_length=200)
  description = models.TextField(blank=True)
  created_by = models.ForeignKey(
    User, on_delete=models.CASCADE,
    related_name='owned_groups')
  group_type = models.CharField(
    max_length=20,
    choices=GROUP_TYPE_CHOICES,
    default='private')
  invite_code = models.CharField(
    max_length=10, unique=True,
    blank=True)
  invite_link = models.CharField(
    max_length=200, blank=True)
  max_members = models.IntegerField(default=100)
  is_active = models.BooleanField(default=True)
  tags = models.JSONField(default=list)
  thumbnail = models.ImageField(
    upload_to='group_thumbnails/',
    null=True, blank=True)
  created_at = models.DateTimeField(
    auto_now_add=True)

  def save(self, *args, **kwargs):
    if not self.invite_code:
      self.invite_code = self._generate_invite_code()
    if not self.invite_link:
      self.invite_link = f'/join/group/{self.invite_code}'
    super().save(*args, **kwargs)

  def _generate_invite_code(self):
    import secrets, string
    chars = string.ascii_uppercase + string.digits
    while True:
      code = ''.join(secrets.choice(chars) for _ in range(8))
      if not Group.objects.filter(invite_code=code).exists():
        return code

  def __str__(self):
    return self.name

class GroupMembership(models.Model):
  ROLE_IN_GROUP = [
    ('member', 'Member'),
    ('moderator', 'Moderator'),
    ('owner', 'Owner'),
  ]
  group = models.ForeignKey(
    Group, on_delete=models.CASCADE,
    related_name='memberships')
  user = models.ForeignKey(
    User, on_delete=models.CASCADE,
    related_name='group_memberships')
  role_in_group = models.CharField(
    max_length=20,
    choices=ROLE_IN_GROUP,
    default='member')
  joined_at = models.DateTimeField(
    auto_now_add=True)

  class Meta:
    unique_together = ['group', 'user']

  def __str__(self):
    return f"{self.user.email} in {self.group.name}"

class GroupResource(models.Model):
  RESOURCE_TYPE_CHOICES = [
    ('file', 'File'),
    ('link', 'Link'),
    ('note', 'Note'),
  ]
  
  group = models.ForeignKey(
    Group, on_delete=models.CASCADE,
    related_name='resources')
  uploaded_by = models.ForeignKey(
    User, on_delete=models.CASCADE,
    related_name='uploaded_resources')
  title = models.CharField(max_length=200)
  description = models.TextField(blank=True)
  resource_type = models.CharField(
    max_length=20,
    choices=RESOURCE_TYPE_CHOICES,
    default='file')
  file = models.FileField(
    upload_to='group_resources/',
    null=True, blank=True)
  link_url = models.URLField(blank=True)
  note_content = models.TextField(blank=True)
  file_size = models.IntegerField(default=0)
  file_extension = models.CharField(
    max_length=20, blank=True)
  download_count = models.IntegerField(default=0)
  created_at = models.DateTimeField(
    auto_now_add=True)

  class Meta:
    ordering = ['-created_at']

  def save(self, *args, **kwargs):
    if self.file:
      self.file_size = self.file.size
      name = self.file.name
      self.file_extension = \
        name.split('.')[-1].upper() \
        if '.' in name else ''
    super().save(*args, **kwargs)
