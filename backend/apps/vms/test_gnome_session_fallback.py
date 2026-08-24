"""
Real, confirmed, second root cause behind "the desktop still doesn't
work" reports on templates built with the gnome-zorin desktop profile
- a DIFFERENT bug from the PAM/account fix in
test_platform_account_provisioning.py, and one that was invisible
until that fix shipped (a PAM failure never gets far enough to reach
this code path at all).

Confirmed live via `gnome-session --session=zorin --debug` on a real,
currently-affected VM: gnome-session looked for
/home/ospace/.config/gnome-session/sessions/zorin.session,
/etc/xdg/gnome-session/sessions/zorin.session,
/usr/local/share/gnome-session/sessions/zorin.session and
/usr/share/gnome-session/sessions/zorin.session - none exist, because
this profile's fix_script only ever installs vanilla
gnome-session/gnome-shell, never a real Zorin OS session package.
gnome-session does NOT fail loudly when the named session is missing;
it silently completes every startup phase with zero real session
components loaded (no window manager, no panel, no desktop),
eventually falling back to `gnome-session-failed` - a real, blank,
broken screen despite xrdp's own login having succeeded cleanly.

The fix (DesktopEnvironmentProfile id=2's session_command, and its
seed value in migration 0012): pick the first session name that is
actually installed (checking for a real .session file on disk) instead
of hardcoding a name that was never genuinely provisioned. Confirmed
live on two independently-repaired templates after this fix: one
(Zorin Desktop) genuinely does have zorin.session on disk and correctly
keeps using it; the other (bengcoe) does not, and correctly falls back
to ubuntu.session - both produce a real, working GNOME desktop
(confirmed via live screenshots showing the real GNOME Initial Setup
wizard, not a blank/failed screen).
"""
from django.test import SimpleTestCase

from apps.vms.migrations import __path__ as _migrations_path
import importlib.util
import os


def _load_migration_module():
    path = os.path.join(list(_migrations_path)[0], '0012_seed_desktop_environment_profiles.py')
    spec = importlib.util.spec_from_file_location('_seed_desktop_env_migration', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class GnomeSessionFallbackTests(SimpleTestCase):
    def setUp(self):
        self.module = _load_migration_module()
        self.script = self.module.GNOME_ZORIN_SESSION_COMMAND

    def test_never_hardcodes_session_equals_zorin_unconditionally(self):
        # The exact real, confirmed-broken line this bug came from.
        # Regression guard: this literal must never come back.
        self.assertNotIn('--session=zorin\n', self.script)
        self.assertNotIn("export GNOME_SHELL_SESSION_MODE=zorin\n", self.script)

    def test_checks_for_a_real_session_file_before_choosing_it(self):
        self.assertIn('/usr/share/gnome-session/sessions/', self.script)
        self.assertIn('-f ', self.script)

    def test_tries_zorin_first_for_templates_that_genuinely_have_it(self):
        # Real templates that DO ship a genuine zorin.session (confirmed
        # live on the repaired Zorin Desktop template) must keep using
        # it - this must stay a preference, not be removed outright.
        loop_line = next(line for line in self.script.splitlines() if line.strip().startswith('for _s in'))
        candidates = loop_line.split('for _s in', 1)[1].split(';')[0].split()
        self.assertEqual(candidates[0], 'zorin')
        self.assertIn('ubuntu', candidates)

    def test_falls_back_to_a_real_session_name_when_zorin_is_absent(self):
        self.assertIn('SESSION=ubuntu', self.script)
        self.assertIn('exec dbus-launch --exit-with-session gnome-session --session="$SESSION"', self.script)

    def test_still_forces_software_gl_rendering(self):
        # Unrelated, already-correct fix from earlier in this build -
        # must not regress while touching this script.
        self.assertIn('LIBGL_ALWAYS_SOFTWARE=1', self.script)
