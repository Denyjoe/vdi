import os
import re

frontend_dir = r'c:\Users\Denis Wilson\Desktop\dit-vdi-system\frontend\src'
api_calls = set()
pattern = re.compile(r'api\.(get|post|put|delete|patch)\(([\'"])([^\'"]+)\2')

for root, _, files in os.walk(frontend_dir):
    for f in files:
        if f.endswith(('.js', '.jsx')):
            try:
                with open(os.path.join(root, f), 'r', encoding='utf-8') as file:
                    content = file.read()
                    matches = pattern.findall(content)
                    for match in matches:
                        endpoint = match[2].split('?')[0]
                        if endpoint.startswith('/'):
                            endpoint = endpoint[1:]
                        api_calls.add(endpoint)
            except Exception as e:
                pass

import sys
sys.path.append(r'c:\Users\Denis Wilson\Desktop\dit-vdi-system\backend')
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.urls import get_resolver
resolver = get_resolver()
backend_urls = set()

def list_urls(patterns, prefix=''):
    for p in patterns:
        if hasattr(p, 'url_patterns'):
            list_urls(p.url_patterns, prefix + str(p.pattern))
        else:
            url = prefix + str(p.pattern)
            # clean up regex artifacts
            url = url.replace('^', '').replace('$', '').replace('\\/', '/')
            if url.startswith('api/'):
                url = url[4:]
            backend_urls.add(url)

list_urls(resolver.url_patterns)

print('--- FRONTEND API CALLS ---')
missing = []
for call in sorted(api_calls):
    # try to match call with backend url (which might have <int:pk> or <uuid:pk> instead of actual ID)
    # this is a basic check
    call_parts = call.split('/')
    matched = False
    for burl in backend_urls:
        burl_parts = burl.split('/')
        if len(call_parts) == len(burl_parts):
            match_parts = True
            for cp, bp in zip(call_parts, burl_parts):
                if cp != bp and not ('<' in bp and '>' in bp):
                    match_parts = False
                    break
            if match_parts:
                matched = True
                break
    if not matched and not call.startswith('${'):
        missing.append(call)

print('\n--- MISSING ENDPOINTS (called by frontend but no exact backend pattern match) ---')
for m in sorted(missing):
    print(m)
