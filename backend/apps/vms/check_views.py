with open('pool_views.py', 'r', encoding='utf-8') as f:
    content = f.read()
    if 'AdminTemplateCreateView' in content:
        print('Create view exists')
    if 'AdminTemplateDeleteView' in content:
        print('Delete view exists')
    if 'AdminTemplateUpdateView' in content:
        print('Update view exists')
