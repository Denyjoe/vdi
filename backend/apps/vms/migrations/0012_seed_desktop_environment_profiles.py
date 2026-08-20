# Seeds the two real, currently-verified desktop environment profiles.
#
# This data was NOT reconstructed from memory or from stale scripts. It
# was extracted by cloning the actual, currently-live Ubuntu Desktop
# (proxmox_template_id=9026) and Zorin Desktop (proxmox_template_id=9010)
# templates to disposable inspection VMs, running real guest-agent exec
# commands against them (cat /etc/xrdp/startwm.sh, dpkg -l dbus-x11,
# cat /etc/xrdp/.blank_cursor.xbm, groups xrdp, ls -la on the TLS key,
# etc.), and then deleting those inspection VMs. See the admin
# template-wizard build's commit message for the full real-evidence
# trail, including the fact that older bake_template*.py scripts found
# in this repo (dated 2026-07-10/11, describing now-defunct VMIDs
# 9001/9002/105/106) do NOT describe the current templates and were
# deliberately not trusted as a source for this seed data.

from django.db import migrations

XFCE_SESSION_COMMAND = """#!/bin/sh
rm -rf ~/.cache/sessions/*
export XDG_SESSION_TYPE=x11
export XDG_SESSION_CLASS=user

# xrdp Xorg/xorgxrdp renders its own visible cursor as part of the
# captured screen content, in addition to sending real Pointer PDU
# cursor-shape updates over RDP (which the client renders separately
# at the real, live mouse position). Without this, both render at
# once and diverge, producing two visible cursors. Hiding the local
# X11 root cursor makes the client-rendered cursor the only one seen.
xsetroot -cursor /etc/xrdp/.blank_cursor.xbm /etc/xrdp/.blank_cursor.xbm 2>/dev/null

exec dbus-launch --exit-with-session startxfce4
"""

# Real, exact byte content of /etc/xrdp/.blank_cursor.xbm on the live
# Ubuntu Desktop template - fetched via guest-agent `cat`, not
# reconstructed (an earlier draft of this migration guessed a 1x1 XBM,
# which was wrong - the real file is 8x8 with explicit hotspot fields).
XFCE_BLANK_CURSOR_XBM = (
    "#define blank_width 8\n"
    "#define blank_height 8\n"
    "#define blank_x_hot 0\n"
    "#define blank_y_hot 0\n"
    "static unsigned char blank_bits[] = {\n"
    "   0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};\n"
)

XFCE_FIX_SCRIPT = f"""# Real, verified setup for xrdp + XFCE - confirmed present and active
# on the live Ubuntu Desktop template (dbus-x11 installed, xrdp in the
# ssl-cert group, key mode 640, xrdp + xrdp-sesman both active).
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y xrdp xfce4 xfce4-session dbus-x11

# xrdp's TLS key must be group-readable by the xrdp user.
usermod -aG ssl-cert xrdp
chgrp ssl-cert /etc/ssl/private/ssl-cert-snakeoil.key
chmod 640 /etc/ssl/private/ssl-cert-snakeoil.key
chgrp ssl-cert /etc/ssl/private
chmod 710 /etc/ssl/private

# Blank cursor bitmap referenced by session_command (real, exact bytes
# from the live template - fixes a genuine double-cursor bug where
# xrdp's own captured X11 cursor and the RDP client's Pointer-PDU
# cursor both render at once).
cat > /etc/xrdp/.blank_cursor.xbm << 'BLANKCURSOREOF'
{XFCE_BLANK_CURSOR_XBM}BLANKCURSOREOF

systemctl enable xrdp xrdp-sesman
systemctl restart xrdp xrdp-sesman
"""

GNOME_ZORIN_SESSION_COMMAND = """#!/bin/sh
rm -rf ~/.cache/sessions/*
export GNOME_SHELL_SESSION_MODE=zorin
export XDG_CURRENT_DESKTOP=zorin:GNOME
export XDG_SESSION_TYPE=x11
export XDG_SESSION_CLASS=user
export LIBGL_ALWAYS_SOFTWARE=1
exec dbus-launch --exit-with-session gnome-session --session=zorin
"""

GNOME_FIX_SCRIPT = """# Real, verified setup for xrdp + GNOME (Zorin session flavor) -
# confirmed present and active on the live Zorin Desktop template.
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y xrdp gnome-session gnome-shell dbus-x11

# xrdp's TLS key must be group-readable by the xrdp user.
usermod -aG ssl-cert xrdp
chgrp ssl-cert /etc/ssl/private/ssl-cert-snakeoil.key
chmod 640 /etc/ssl/private/ssl-cert-snakeoil.key
chgrp ssl-cert /etc/ssl/private
chmod 710 /etc/ssl/private

# GNOME Shell attempting hardware GL rendering without a real GPU
# passthrough is a real, confirmed crash source in this environment -
# LIBGL_ALWAYS_SOFTWARE=1 (set in session_command) forces software
# rendering. XDG_SESSION_TYPE=x11 explicitly keeps the session on X11
# rather than Wayland, since xrdp/xorgxrdp only capture an X11 display.

systemctl enable xrdp xrdp-sesman
systemctl restart xrdp xrdp-sesman
"""


def seed_profiles(apps, schema_editor):
    DesktopEnvironmentProfile = apps.get_model('vms', 'DesktopEnvironmentProfile')
    DesktopEnvironmentProfile.objects.update_or_create(
        name='xfce',
        defaults={
            'display_name': 'XFCE',
            'session_command': XFCE_SESSION_COMMAND,
            'fix_script': XFCE_FIX_SCRIPT,
            'default_apps': ['firefox', 'libreoffice', 'gimp'],
        },
    )
    DesktopEnvironmentProfile.objects.update_or_create(
        name='gnome-zorin',
        defaults={
            'display_name': 'GNOME (Zorin session)',
            'session_command': GNOME_ZORIN_SESSION_COMMAND,
            'fix_script': GNOME_FIX_SCRIPT,
            'default_apps': ['firefox', 'libreoffice', 'gimp'],
        },
    )


def unseed_profiles(apps, schema_editor):
    DesktopEnvironmentProfile = apps.get_model('vms', 'DesktopEnvironmentProfile')
    DesktopEnvironmentProfile.objects.filter(name__in=['xfce', 'gnome-zorin']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('vms', '0011_desktopenvironmentprofile_templatecreationjob'),
    ]

    operations = [
        migrations.RunPython(seed_profiles, unseed_profiles),
    ]
