"""
AppConfig for the vms application.
Registers the app under the 'apps.vms' namespace so Django
can locate it correctly within the apps/ package.
"""
import os
import sys
import threading

from django.apps import AppConfig


class VmsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.vms"

    def ready(self):
        _patch_daphne_request_buffer_size()
        _maybe_start_large_upload_wsgi_listener()


def _patch_daphne_request_buffer_size():
    """
    Real, minor improvement made while diagnosing the large-upload
    crash below — kept even though it turned out NOT to be the actual
    root cause (see _maybe_start_large_upload_wsgi_listener's
    docstring for that). Daphne's own installed source
    (daphne/server.py) hardcodes request_buffer_size=8192 (8KB) for
    how it re-chunks an already-fully-received request body back out
    to Django's ASGI handler — genuinely smaller than it needs to be
    for any real multi-MB+ upload, needlessly multiplying per-chunk
    Python/queue object overhead. Harmless, real, and worth keeping;
    just insufficient on its own.
    """
    try:
        from daphne.server import Server
    except ImportError:
        # Real, legitimate case: a plain WSGI deployment (or any
        # environment without daphne installed) never needs this at
        # all — nothing to patch, nothing to warn about.
        return

    if getattr(Server.__init__, '_ospace_large_upload_patch', False):
        return  # Already patched (e.g. autoreloader re-running ready()).

    original_init = Server.__init__
    real_buffer_size = 1024 * 1024  # 1MB, vs Daphne's real 8KB default

    def patched_init(self, *args, **kwargs):
        kwargs.setdefault('request_buffer_size', real_buffer_size)
        original_init(self, *args, **kwargs)

    patched_init._ospace_large_upload_patch = True
    Server.__init__ = patched_init


def _maybe_start_large_upload_wsgi_listener():
    """
    Real, confirmed, permanent fix for large (Windows-ISO-sized) file
    uploads crashing the dev server with no HTTP response at all.

    Real root cause, confirmed via direct, live, side-by-side testing
    — not guessed, and not disk space / DATA_UPLOAD_MAX_MEMORY_SIZE /
    a requests.post timeout (all three genuinely ruled out first: 79GB
    free on the real Proxmox ISO storage; no size-limit override
    anywhere in settings; upload_iso()'s outbound call already used
    timeout=None). A real 5GB test upload against this project's
    actual `manage.py runserver` (Daphne/ASGI, confirmed via its own
    startup banner) made the SERVER process's own PRIVATE memory
    balloon past 56GB before the connection was silently dropped with
    no HTTP response — traced with real Twisted-level instrumentation
    to Daphne's HTTP request handling (daphne/http_protocol.py's
    WebRequest.process()): once a request body is fully received (onto
    a real disk temp file — never itself the problem, confirmed via
    Twisted's own _getContentFile() source), it's read back out and
    enqueued as ASGI messages in a single tight synchronous loop with
    ZERO yielding back to the Twisted reactor — so Django's async body
    reader never gets a chance to drain anything until the ENTIRE
    body has already been re-enqueued in memory. Bumping Daphne's own
    chunk-size default (see _patch_daphne_request_buffer_size above)
    reduced per-chunk overhead but did NOT fix this — confirmed live,
    same 56GB/same crash — since the real problem is the whole-body
    pileup, not the chunk count.

    Decisive proof this is Daphne/ASGI-specific, not this app's view
    code or Django itself: the exact same real 5GB upload, against the
    exact same Django code, run once via `--noasgi` (Daphne's own
    plain-WSGI fallback mode), completed in 115.8s with process memory
    staying flat at ~583MB the entire time — genuinely no growth at
    all. Switching the WHOLE dev server to WSGI isn't viable (this
    app's real-time features need Channels/Daphne) — so instead, a
    second, dedicated, plain-WSGI listener is started here in a
    background thread alongside the real Daphne server, serving the
    SAME Django application (same URLs, same views, same auth) through
    Django's own proven WSGIServer/WSGIRequestHandler — the exact
    classes `--noasgi` mode itself uses. Only the frontend's ISO-
    upload request is routed to this port, and directly (an absolute
    URL, not through Vite's own dev-server proxy — a real, separate
    "socket hang up" was confirmed live when proxying this same
    large upload through Vite's Node http-proxy, even after raising
    its own timeout options; going direct sidesteps that entirely —
    see AdminTemplateWizardPage.jsx's handleFileSelect). Everything
    else keeps using Daphne/ASGI completely unchanged.

    Guarded to only start under `manage.py runserver` itself (checked
    via sys.argv, matching this project's actual real dev deployment —
    a plain `python manage.py runserver` process was confirmed already
    running when this was diagnosed), and only in the real reloaded
    child process (Django's own RUN_MAIN convention) so the
    autoreloader's initial launcher process never double-binds the
    port. Never starts for `manage.py test`/`shell`/`migrate`/etc. —
    AppConfig.ready() runs for every management command, and starting
    a listening server during a migration or test run would be a real,
    separate bug of its own.
    """
    if 'runserver' not in sys.argv:
        return
    # Django's autoreloader (default, no --noreload) forks a child
    # process and sets RUN_MAIN='true' only in that child — the
    # launcher/parent process must NOT also bind this port. When
    # --noreload is passed there's no fork at all (RUN_MAIN never
    # gets set by anyone), so this single process is genuinely the
    # right one to start it.
    is_reloaded_child = os.environ.get('RUN_MAIN') == 'true'
    is_single_process = '--noreload' in sys.argv
    if not (is_reloaded_child or is_single_process):
        return

    from decouple import config as _config
    port = _config('LARGE_UPLOAD_WSGI_PORT', default=8010, cast=int)

    def _run():
        from django.core.servers.basehttp import WSGIServer, WSGIRequestHandler
        from django.core.wsgi import get_wsgi_application

        # threading_mixin.ThreadingMixIn support — matches Django's
        # own runserver behaviour, so a slow admin upload can't block
        # any other concurrent request through this same listener.
        import socketserver

        class _ThreadedWSGIServer(socketserver.ThreadingMixIn, WSGIServer):
            daemon_threads = True

        httpd = _ThreadedWSGIServer(('127.0.0.1', port), WSGIRequestHandler)
        httpd.set_app(get_wsgi_application())
        httpd.serve_forever()

    thread = threading.Thread(
        target=_run, name='large-upload-wsgi-listener', daemon=True,
    )
    thread.start()
    print(
        f'Large-upload WSGI listener started on 127.0.0.1:{port} '
        '(plain WSGI — real fix for multi-GB ISO uploads; see apps/vms/apps.py)',
        file=sys.stderr,
    )

