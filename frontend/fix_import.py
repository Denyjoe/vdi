import sys

with open('src/pages/member/DesktopSessionPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'Monitor, Maximize2, LayoutGrid, Compass, BarChart2, ',
    'Monitor, Maximize2, LayoutGrid, Compass, BarChart2, AlertCircle, '
)

with open('src/pages/member/DesktopSessionPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added AlertCircle import")
