import sys

with open('src/services/api.js', 'r', encoding='utf-8') as f:
    content = f.read()

maintenance_block = """
        // Handle 503 Maintenance Mode
        if (error.response?.status === 503 && error.response?.data?.maintenance) {
            window.location.href = '/maintenance';
            return Promise.reject(error);
        }
"""

if 'error.response?.status === 503' not in content:
    content = content.replace(
        'const originalRequest = error.config;',
        'const originalRequest = error.config;\n' + maintenance_block
    )
    with open('src/services/api.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added 503 interceptor")
else:
    print("Already exists")
