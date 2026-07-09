import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add free_hours_per_month to initial state
content = content.replace("newPassword: ''\n    });", "newPassword: '',\n      free_hours_per_month: 0\n    });")

# Add the input block
input_block = '''              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Platform Name</label>'''

new_input_block = '''              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Platform Name</label>'''
                  
content = content.replace(input_block, new_input_block)

support_email_block = '''                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Support Email</label>
                  <input type="email" className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                    value={platformConfig.support_email} onChange={e => handlePlatformChange('support_email', e.target.value)} />
                </div>
              </div>'''

new_support_email_block = '''                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Support Email</label>
                  <input type="email" className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                    value={platformConfig.support_email || ''} onChange={e => handlePlatformChange('support_email', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Free Hours Per Month</label>
                  <input type="number" min="0" className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                    value={platformConfig.free_hours_per_month || 0} onChange={e => handlePlatformChange('free_hours_per_month', parseInt(e.target.value) || 0)} />
                  <p className="text-[10px] text-[var(--text-faint)] mt-1">Hours every user gets free each month before hourly billing starts</p>
                </div>
              </div>'''
content = content.replace(support_email_block, new_support_email_block)

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
