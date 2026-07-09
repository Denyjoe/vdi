with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/views.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_login_block = '''    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        user = User.objects.filter(email=email).first()
        if user and user.check_password(password):
            if user.is_suspended:
                return Response({
                    'success': False,
                    'message': (
                        'Your account has been '
                        'suspended. Contact support '
                        'at support@clouddesk.io')
                }, status=403)
                
            if not user.is_active or not user.is_approved:
                return Response({
                    "success": False,
                    "message": "Account is inactive or pending approval"
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            if not user.is_verified and user.role != 'admin' and not user.is_staff and not user.is_superuser:
                return Response({
                    "success": False,
                    "message": "Please verify your email first",
                    "needs_verification": True
                }, status=status.HTTP_401_UNAUTHORIZED)
                
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "success": True,
                "data": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": UserProfileSerializer(user).data
                }
            })
            
        return Response({
            "success": False,
            "message": "Invalid email or password"
        }, status=status.HTTP_401_UNAUTHORIZED)'''

new_login_block = '''    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ',' in ip:
            ip = ip.split(',')[0].strip()
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255]
        
        from apps.users.models import LoginAttempt
        
        user = User.objects.filter(email=email).first()
        if user and user.check_password(password):
            if user.is_suspended:
                LoginAttempt.objects.create(email=email, success=False, ip_address=ip, user_agent=user_agent)
                return Response({
                    'success': False,
                    'message': (
                        'Your account has been '
                        'suspended. Contact support '
                        'at support@clouddesk.io')
                }, status=403)
                
            if not user.is_active or not user.is_approved:
                LoginAttempt.objects.create(email=email, success=False, ip_address=ip, user_agent=user_agent)
                return Response({
                    "success": False,
                    "message": "Account is inactive or pending approval"
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            if not user.is_verified and user.role != 'admin' and not user.is_staff and not user.is_superuser:
                LoginAttempt.objects.create(email=email, success=False, ip_address=ip, user_agent=user_agent)
                return Response({
                    "success": False,
                    "message": "Please verify your email first",
                    "needs_verification": True
                }, status=status.HTTP_401_UNAUTHORIZED)
                
            LoginAttempt.objects.create(email=email, success=True, ip_address=ip, user_agent=user_agent)
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "success": True,
                "data": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": UserProfileSerializer(user).data
                }
            })
            
        LoginAttempt.objects.create(email=email, success=False, ip_address=ip, user_agent=user_agent)
        return Response({
            "success": False,
            "message": "Invalid email or password"
        }, status=status.HTTP_401_UNAUTHORIZED)'''

content = content.replace(old_login_block, new_login_block)

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/views.py', 'w', encoding='utf-8') as f:
    f.write(content)
