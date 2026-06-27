with open('apps/users/views.py', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'UserProfileSerializer(user)' in line:
        lines[i] = line.replace('UserProfileSerializer(user)', "UserProfileSerializer(user, context={'request': request})")
    elif 'UserProfileSerializer(request.user)' in line:
        lines[i] = line.replace('UserProfileSerializer(request.user)', "UserProfileSerializer(request.user, context={'request': request})")
    elif 'UserProfileSerializer(request.user, data=request.data, partial=True)' in line:
        lines[i] = line.replace('UserProfileSerializer(request.user, data=request.data, partial=True)', "UserProfileSerializer(request.user, data=request.data, partial=True, context={'request': request})")
    elif 'UserProfileSerializer(queryset, many=True)' in line:
        lines[i] = line.replace('UserProfileSerializer(queryset, many=True)', "UserProfileSerializer(queryset, many=True, context={'request': request})")

with open('apps/users/views.py', 'w') as f:
    f.writelines(lines)
print('Fixed UserProfileSerializer contexts')
