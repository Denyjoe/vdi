with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/models.py', 'r', encoding='utf-8') as f:
    content = f.read()

login_model = '''

class LoginAttempt(models.Model):
    email = models.CharField(max_length=255)
    success = models.BooleanField()
    ip_address = models.CharField(max_length=45, blank=True, default='')
    user_agent = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
'''

if 'class LoginAttempt' not in content:
    with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/models.py', 'a', encoding='utf-8') as f:
        f.write(login_model)
    print("Added LoginAttempt model.")
else:
    print("LoginAttempt already exists.")
