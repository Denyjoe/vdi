import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the hardcoded Proxmox host block
old_proxmox = '''<p className="text-xs text-muted mb-1">Proxmox Host</p>
                <p className="text-sm text-[var(--text-primary)] font-mono">192.168.1.13 (pve)</p>
                <p className="text-sm mt-2 flex items-center gap-1.5">
                  <span className={w-2 h-2 rounded-full }></span>
                  <span className={infraStats?.proxmox?.status === 'online' ? 'text-emerald-400' : 'text-red-400'}>
                    {infraStats?.proxmox?.status === 'online' ? 'Connected' : 'Offline'}
                  </span>
                </p>'''
new_proxmox = '''<p className="text-xs text-[var(--text-secondary)] mb-1">Proxmox Host</p>
                <p className="text-sm text-[var(--text-primary)] font-mono">{infraStats?.proxmox?.host || 'Loading...'} ({infraStats?.proxmox?.node || 'pve'})</p>
                <div className="text-sm mt-2 flex flex-col gap-1">
                  <p className="flex items-center gap-1.5">
                    <span className={w-2 h-2 rounded-full }></span>
                    <span className={infraStats?.proxmox?.status === 'online' ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                      {infraStats?.proxmox?.status === 'online' ? 'Connected' : 'Offline'}
                    </span>
                  </p>
                  {infraStats?.proxmox?.error && (
                    <p className="text-xs text-red-400/80 font-mono mt-1 break-all" title={infraStats.proxmox.error}>
                      Error: {infraStats.proxmox.error.length > 60 ? infraStats.proxmox.error.substring(0, 60) + '...' : infraStats.proxmox.error}
                    </p>
                  )}
                </div>'''
content = content.replace(old_proxmox, new_proxmox)

# Replace the hardcoded Guacamole URL block
old_guac = '''<p className="text-xs text-muted mb-1">Guacamole URL</p>
                <p className="text-sm text-[var(--text-primary)] font-mono">localhost:8080</p>
                <p className="text-sm mt-2 flex items-center gap-1.5">
                  <span className={w-2 h-2 rounded-full }></span>
                  <span className={infraStats?.guacamole?.status === 'online' ? 'text-emerald-400' : 'text-red-400'}>
                    {infraStats?.guacamole?.status === 'online' ? 'Connected' : 'Offline'}
                  </span>
                </p>'''
new_guac = '''<p className="text-xs text-[var(--text-secondary)] mb-1">Guacamole URL</p>
                <p className="text-sm text-[var(--text-primary)] font-mono">{infraStats?.guacamole?.url || 'Loading...'}</p>
                <div className="text-sm mt-2 flex flex-col gap-1">
                  <p className="flex items-center gap-1.5">
                    <span className={w-2 h-2 rounded-full }></span>
                    <span className={infraStats?.guacamole?.status === 'online' ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                      {infraStats?.guacamole?.status === 'online' ? 'Connected' : 'Offline'}
                    </span>
                  </p>
                  {infraStats?.guacamole?.error && (
                    <p className="text-xs text-red-400/80 font-mono mt-1 break-all" title={infraStats.guacamole.error}>
                      Error: {infraStats.guacamole.error.length > 60 ? infraStats.guacamole.error.substring(0, 60) + '...' : infraStats.guacamole.error}
                    </p>
                  )}
                </div>'''
content = content.replace(old_guac, new_guac)

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated AdminSettingsPage.jsx')
