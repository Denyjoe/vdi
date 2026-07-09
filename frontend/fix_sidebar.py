import re

with open('src/components/layout/Sidebar.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix NavItem signature
if 'badge' not in content.split('function NavItem(')[1].split(')')[0]:
    content = content.replace('function NavItem({ icon: Icon, label, path, onClick, collapsed, active, accent, theme })', 
                              'function NavItem({ icon: Icon, label, path, onClick, collapsed, active, accent, theme, badge })')

# The badge block string
badge_block = """
      {!collapsed && badge && (
        <span style={{
          marginLeft: 'auto',
          padding: '2px 7px',
          borderRadius: '9999px',
          fontSize: '10px',
          fontWeight: 700,
          background: 'var(--status-online-bg)',
          color: 'var(--status-online)',
        }}>
          {badge}
        </span>
      )}
      {collapsed && badge && (
        <span style={{
          position: 'absolute',
          top: '2px', right: '2px',
          width: '8px', height: '8px',
          borderRadius: '50%',
          background: 'var(--status-online)',
        }} />
      )}"""

# Remove all occurrences of the badge block
content = content.replace(badge_block, "")

# Add it back to NavItem
# The NavItem component ends with </button>
# Let's insert it right before the </button> inside NavItem.
# We know NavItem is the first component in the file.
parts = content.split('</button>')
# parts[0] is the content of NavItem up to the closing button tag
parts[0] = parts[0] + badge_block + "\n"
content = '</button>'.join(parts)

with open('src/components/layout/Sidebar.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed Sidebar.jsx")
