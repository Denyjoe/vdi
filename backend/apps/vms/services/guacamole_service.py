"""
Apache Guacamole API integration service.

All Guacamole API calls go through this single file. Uses the Guacamole
REST API to create, delete, and manage remote desktop connections.
Credentials are read from .env via python-decouple.

This service handles:
    - Authenticating with the Guacamole server
    - Creating RDP connections for VMs
    - Deleting connections on VM teardown
    - Building direct client URLs for browser embedding

Token caching & retry strategy:
    - Auth tokens are cached in Django's cache backend to avoid
      re-authenticating on every request.
    - All API calls go through _request(), which detects 401/403
      responses and automatically re-authenticates once before
      retrying the failed request.
"""

import base64
import logging
import requests
from decouple import config

logger = logging.getLogger(__name__)

# Guacamole connection constants (from .env)
GUACAMOLE_URL = config(
    'GUACAMOLE_URL', default='http://localhost:8080/guacamole')
GUACAMOLE_ADMIN_USER = config(
    'GUACAMOLE_ADMIN_USER', default='guacadmin')
GUACAMOLE_ADMIN_PASSWORD = config(
    'GUACAMOLE_ADMIN_PASSWORD', default='')
GUACAMOLE_PUBLIC_URL = config(
    'GUACAMOLE_PUBLIC_URL', default='http://localhost:8080/guacamole')

# Default VM credentials for RDP connections
VM_DEFAULT_USER = config('VM_DEFAULT_USER', default='student')
VM_DEFAULT_PASSWORD = config('VM_DEFAULT_PASSWORD', default='student123')

# HTTP request timeout in seconds
REQUEST_TIMEOUT_SECONDS = 15

# Cache TTL for Guacamole auth tokens (seconds).
# Guacamole default token lifetime is 60 min; we cache for 50 min
# to leave a safety margin.
TOKEN_CACHE_TTL_SECONDS = 3000

# HTTP status codes that indicate a stale/invalid auth token
AUTH_REJECTION_CODES = (401, 403)


class GuacamoleService:
    """
    Wraps all interactions with the Apache Guacamole REST API.

    Manages authentication tokens and provides methods for
    creating/deleting RDP connections.

    Attributes:
        base_url (str): Guacamole server base URL.
        admin_user (str): Admin username for API auth.
        admin_pass (str): Admin password for API auth.
        token (str or None): Current auth token.
        data_source (str or None): Guacamole data source identifier.
    """

    def __init__(self):
        """Initialise service with config values; no network call yet."""
        from django.core.cache import cache
        self.base_url = GUACAMOLE_URL
        self.admin_user = GUACAMOLE_ADMIN_USER
        self.admin_pass = GUACAMOLE_ADMIN_PASSWORD
        self.token = cache.get('guac_admin_token')
        self.data_source = cache.get('guac_admin_data_source')

    def authenticate(self, force=False):
        """
        Obtain a Guacamole auth token.

        When force=False (default), returns immediately if a cached
        token exists. When force=True, discards the cached token and
        fetches a fresh one from the Guacamole /api/tokens endpoint.

        Args:
            force (bool): If True, bypass the cache and re-authenticate.

        Returns:
            bool: True if authentication succeeded.
        """
        from django.core.cache import cache

        if not force:
            cached_token = cache.get('guac_admin_token')
            if cached_token:
                self.token = cached_token
                self.data_source = cache.get('guac_admin_data_source')
                return True

        try:
            res = requests.post(
                f'{self.base_url}/api/tokens',
                data={
                    'username': self.admin_user,
                    'password': self.admin_pass,
                },
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            if res.status_code == 200:
                data = res.json()
                self.token = data['authToken']
                self.data_source = data['dataSource']
                cache.set(
                    'guac_admin_token',
                    self.token,
                    timeout=TOKEN_CACHE_TTL_SECONDS,
                )
                cache.set(
                    'guac_admin_data_source',
                    self.data_source,
                    timeout=TOKEN_CACHE_TTL_SECONDS,
                )
                logger.info("Authenticated with Guacamole")
                return True

            logger.error(
                "Guacamole auth failed: %s %s",
                res.status_code, res.text,
            )
            return False
        except requests.RequestException as exc:
            logger.error("Guacamole auth error: %s", exc)
            return False

    def _ensure_authenticated(self):
        """Re-authenticate if we don't have a valid token."""
        if not self.token:
            self.authenticate()

    def _request(self, method, url, **kwargs):
        """
        Make an authenticated Guacamole API request with auto-retry.

        Injects the current auth token into the request params.
        If Guacamole responds with 401 or 403 (stale/invalid token),
        automatically re-authenticates once with force=True and
        retries the exact same request.

        Args:
            method (str): HTTP method ('GET', 'POST', 'DELETE', etc.).
            url (str): Full URL for the request.
            **kwargs: Passed directly to requests.request().

        Returns:
            requests.Response: The HTTP response object.

        Raises:
            requests.RequestException: On network-level errors.
        """
        self._ensure_authenticated()

        kwargs.setdefault('timeout', REQUEST_TIMEOUT_SECONDS)
        kwargs.setdefault('params', {})
        kwargs['params']['token'] = self.token

        response = requests.request(method, url, **kwargs)

        if response.status_code in AUTH_REJECTION_CODES:
            logger.warning(
                "Guacamole returned %s for %s %s — "
                "re-authenticating with fresh token",
                response.status_code, method, url,
            )
            if self.authenticate(force=True):
                kwargs['params']['token'] = self.token
                response = requests.request(method, url, **kwargs)
            else:
                logger.error(
                    "Re-authentication failed; returning original "
                    "%s response", response.status_code,
                )

        return response

    def create_connection(
        self, name, hostname,
        username=None, password=None, port='3389', restrictions=None
    ):
        """
        Create an RDP connection in Guacamole.

        Args:
            name (str): Display name for the connection.
            hostname (str): IP or hostname of the VM.
            username (str): RDP login username (defaults to VM_DEFAULT_USER).
            password (str): RDP login password (defaults to VM_DEFAULT_PASSWORD).
            port (str): RDP port (default '3389').
            restrictions (dict): Session control restrictions.

        Returns:
            str or None: Connection identifier, or None on failure.
        """
        # Must run before the URL below is built — it's an f-string
        # evaluated eagerly as a call argument, so self.data_source has to
        # be populated *before* this point, not inside _request().
        self._ensure_authenticated()

        if username is None:
            username = VM_DEFAULT_USER
        if password is None:
            password = VM_DEFAULT_PASSWORD

        parameters = {
            "hostname": hostname,
            "port": port,
            "username": username,
            "password": password,
            "security": "any",
            "ignore-cert": "true",
            # Let the RDP session's resolution follow the client viewport
            # (fullscreen toggle, window resize, phone/tablet rotation)
            # instead of staying fixed at whatever size it first connected
            # at. Requires the RDP server to support the display-update
            # virtual channel (xrdp on recent Ubuntu/Zorin templates does).
            "resize-method": "display-update",
        }

        if restrictions:
            if not restrictions.get('clipboard', True):
                parameters["disable-copy"] = "true"
                parameters["disable-paste"] = "true"

            if not restrictions.get('file_transfer', True):
                parameters["disable-download"] = "true"
                parameters["disable-upload"] = "true"

            if restrictions.get('audio', False):
                parameters['enable-audio'] = 'true'
                parameters['enable-audio-input'] = 'true'
            else:
                parameters['enable-audio'] = 'false'
                parameters['enable-audio-input'] = 'false'

            if restrictions.get('interaction_mode') == 'view_only':
                parameters["read-only"] = "true"

            if restrictions.get('session_recording'):
                parameters["recording-path"] = "/var/lib/guacamole/recordings"
                parameters["recording-name"] = f"{name}-recording"
                parameters["create-recording-path"] = "true"

        payload = {
            "parentIdentifier": "ROOT",
            "name": name,
            "protocol": "rdp",
            "parameters": parameters,
            "attributes": {
                "max-connections": "5",
                "max-connections-per-user": "5",
            },
        }

        try:
            res = self._request(
                'POST',
                f'{self.base_url}/api/session/data/'
                f'{self.data_source}/connections',
                json=payload,
            )

            if res.status_code == 200:
                conn_id = res.json()['identifier']
                logger.info(
                    "Created Guacamole connection %s for %s (%s)",
                    conn_id, name, hostname,
                )
                return conn_id

            logger.error(
                "Guacamole create connection failed: %s %s",
                res.status_code, res.text,
            )
            return None
        except requests.RequestException as exc:
            logger.error("Guacamole create connection error: %s", exc)
            return None

    def create_ssh_connection(self, name, hostname, username, password, port='22'):
        """
        Create a real SSH connection in Guacamole — the in-app terminal
        used by the admin template wizard. Confirmed via a real schema
        query (GET .../schema/protocols) that 'ssh' is genuinely a
        supported protocol in this deployment, not assumed.

        Reuses the exact same request/retry/attribute pattern as
        create_connection() above (same _request() wrapper with its
        built-in retry-on-401, same max-connections attributes), just
        with protocol='ssh' and SSH's own real parameter names.

        Args:
            name (str): Display name for the connection.
            hostname (str): IP or hostname of the VM.
            username (str): SSH login username.
            password (str): SSH login password.
            port (str): SSH port (default '22').

        Returns:
            str: Connection identifier.

        Raises:
            Exception: If Guacamole genuinely rejects the connection
                creation — never silently swallowed, since the wizard's
                open-terminal endpoint needs a real error to surface to
                the admin, not a None it might not check for.
        """
        self._ensure_authenticated()

        payload = {
            "parentIdentifier": "ROOT",
            "name": name,
            "protocol": "ssh",
            "parameters": {
                "hostname": hostname,
                "port": port,
                "username": username,
                "password": password,
                "color-scheme": "gray-black",
                "font-size": "12",
            },
            "attributes": {
                "max-connections": "5",
                "max-connections-per-user": "5",
            },
        }

        try:
            res = self._request(
                'POST',
                f'{self.base_url}/api/session/data/'
                f'{self.data_source}/connections',
                json=payload,
            )
        except requests.RequestException as exc:
            logger.error("Guacamole create SSH connection error: %s", exc)
            raise Exception(f'Network error creating SSH connection: {exc}')

        if res.status_code == 200:
            conn_id = res.json()['identifier']
            logger.info(
                "Created Guacamole SSH connection %s for %s (%s)",
                conn_id, name, hostname,
            )
            return conn_id

        logger.error(
            "Guacamole create SSH connection failed: %s %s",
            res.status_code, res.text,
        )
        raise Exception(f'Guacamole rejected the SSH connection: {res.status_code} {res.text}')

    def create_vnc_connection(self, name, hostname, port, password):
        """
        Create a real VNC connection in Guacamole — used to embed a
        VM's actual Proxmox install console (real RFB stream, relayed
        through the local vnc_bridge service) directly in the admin
        template wizard. Confirmed 'vnc' is genuinely supported via the
        same schema query used for 'ssh'.

        `hostname`/`port` must point at the LOCAL bridge
        (127.0.0.1:<local_port> from vnc_bridge.start_vnc_bridge), not
        at Proxmox directly — Proxmox never exposes raw VNC/TCP
        externally. `password` is the real RFB auth password that
        belongs to the specific ticket that bridge was opened with.

        Reuses the exact same request/retry/attribute pattern as
        create_connection()/create_ssh_connection() above.

        Args:
            name (str): Display name for the connection.
            hostname (str): Local bridge host (normally '127.0.0.1').
            port (str/int): Local bridge port.
            password (str): Real RFB auth password for this ticket.

        Returns:
            str: Connection identifier.

        Raises:
            Exception: If Guacamole genuinely rejects the connection
                creation — never silently swallowed.
        """
        self._ensure_authenticated()

        payload = {
            "parentIdentifier": "ROOT",
            "name": name,
            "protocol": "vnc",
            "parameters": {
                "hostname": hostname,
                "port": str(port),
                "password": password,
                "cursor": "remote",
                # Real, same-LAN tuning: this connection never leaves
                # 192.168.1.0/24 (backend -> Proxmox -> guacd, all
                # confirmed on the same subnet), so bandwidth is
                # abundant and never the constraint VNC's default
                # encoding preference is tuned for. Left unset,
                # Guacamole's VNC client negotiates its own default
                # order, which favors CPU-heavy compressed encodings
                # (tight/zrle) meant for slow WAN links — pure
                # overhead here. Preferring cheap, uncompressed
                # encodings first cuts that CPU cost on both the
                # Proxmox and guacd ends without giving up anything a
                # LAN connection needs.
                "encodings": "copyrect raw",
            },
            "attributes": {
                "max-connections": "5",
                "max-connections-per-user": "5",
            },
        }

        try:
            res = self._request(
                'POST',
                f'{self.base_url}/api/session/data/'
                f'{self.data_source}/connections',
                json=payload,
            )
        except requests.RequestException as exc:
            logger.error("Guacamole create VNC connection error: %s", exc)
            raise Exception(f'Network error creating VNC connection: {exc}')

        if res.status_code == 200:
            conn_id = res.json()['identifier']
            logger.info(
                "Created Guacamole VNC connection %s for %s (%s:%s)",
                conn_id, name, hostname, port,
            )
            return conn_id

        logger.error(
            "Guacamole create VNC connection failed: %s %s",
            res.status_code, res.text,
        )
        raise Exception(f'Guacamole rejected the VNC connection: {res.status_code} {res.text}')

    def delete_connection(self, connection_id):
        """
        Delete a Guacamole connection.

        Args:
            connection_id (str): The connection identifier to delete.

        Returns:
            bool: True if deletion succeeded.

        Raises:
            Exception: If the server returns a non-success status.
        """
        self._ensure_authenticated()

        res = self._request(
            'DELETE',
            f'{self.base_url}/api/session/data/'
            f'{self.data_source}/connections/{connection_id}',
        )

        if res.status_code not in [200, 204]:
            raise Exception(
                f'Failed to delete connection {connection_id}: '
                f'{res.status_code} {res.text}'
            )

        # Scoped users (see get_connection_url) are per-connection — once
        # the connection itself is gone, its scoped user must go too, or
        # it'd be an orphaned account left behind on every VM teardown.
        self.delete_scoped_user(connection_id)

        logger.info("Deleted Guacamole connection %s", connection_id)
        return True

    def create_sharing_profile(self, connection_id, read_only=True):
        """Create a Guacamole sharing profile for an existing connection.

        read_only=False grants full interactive control.

        Idempotent: if a matching sharing profile already exists for this
        connection_id and read_only setting, the existing identifier is returned
        without creating a duplicate.

        Args:
            connection_id (str): The Guacamole connection identifier.
            read_only (bool): Whether the sharing profile grants read-only access.

        Returns:
            str: The sharing profile identifier.

        Raises:
            Exception: If creation fails.
        """
        self._ensure_authenticated()

        profile_name = f'shadow-{connection_id}-{"ro" if read_only else "rw"}'

        # STEP 1: Check if a profile already exists for this exact connection.
        try:
            list_res = self._request(
                'GET',
                f'{self.base_url}/api/session/data/'
                f'{self.data_source}/sharingProfiles',
            )
            if list_res.status_code == 200:
                for k, v in list_res.json().items():
                    if (str(v.get('primaryConnectionIdentifier')) == str(connection_id)
                            and v.get('name') == profile_name):
                        logger.info(
                            "Reusing existing sharing profile %s "
                            "for connection %s", k, connection_id,
                        )
                        return k
        except requests.RequestException as exc:
            logger.warning(
                "Could not list sharing profiles, will attempt create: %s", exc,
            )

        # STEP 2: None found — create a new one.
        payload = {
            'name': profile_name,
            'primaryConnectionIdentifier': str(connection_id),
            'parameters': {
                'read-only': 'true' if read_only else 'false'
            },
            'attributes': {}
        }

        try:
            res = self._request(
                'POST',
                f'{self.base_url}/api/session/data/'
                f'{self.data_source}/sharingProfiles',
                json=payload,
            )

            if res.status_code in [200, 201]:
                identifier = res.json().get('identifier')
                logger.info(
                    "Created Guacamole sharing profile %s for "
                    "connection %s (read_only=%s)",
                    identifier, connection_id, read_only,
                )
                return identifier

            logger.error(
                "Guacamole create sharing profile failed: %s %s",
                res.status_code, res.text,
            )
            raise Exception(
                f'Failed to create sharing profile: '
                f'{res.status_code} {res.text}'
            )
        except requests.RequestException as exc:
            logger.error("Guacamole create sharing profile error: %s", exc)
            raise Exception(f'Network error creating sharing profile: {exc}')

    def _scoped_username(self, connection_id):
        return f'pcuser-{connection_id}'

    def _get_or_create_scoped_user(self, connection_id):
        """Ensure a Guacamole user exists whose ONLY permission is READ on
        this one connection_id, and return a fresh password for it.

        The password is regenerated on every call and pushed to Guacamole
        (create if the user doesn't exist yet, otherwise rotate its
        password) rather than persisted anywhere in this app — nothing
        beyond this one function ever needs to know it, since the caller
        immediately exchanges it for a token and discards it.
        """
        import secrets
        self._ensure_authenticated()
        username = self._scoped_username(connection_id)
        password = secrets.token_urlsafe(24)

        check = self._request(
            'GET',
            f'{self.base_url}/api/session/data/{self.data_source}/users/{username}',
        )
        if check.status_code == 200:
            upd = self._request(
                'PUT',
                f'{self.base_url}/api/session/data/{self.data_source}/users/{username}',
                json={'username': username, 'password': password, 'attributes': {}},
            )
            if upd.status_code not in (200, 204):
                raise Exception(
                    f'Failed to rotate scoped Guacamole user password: '
                    f'{upd.status_code} {upd.text}'
                )
            return password

        create = self._request(
            'POST',
            f'{self.base_url}/api/session/data/{self.data_source}/users',
            json={'username': username, 'password': password, 'attributes': {}},
        )
        if create.status_code not in (200, 201):
            raise Exception(
                f'Failed to create scoped Guacamole user: '
                f'{create.status_code} {create.text}'
            )

        # The entire point: grant READ on this ONE connection and nothing
        # else — this user can never see or use any other connection.
        perm = self._request(
            'PATCH',
            f'{self.base_url}/api/session/data/{self.data_source}/users/{username}/permissions',
            json=[{'op': 'add', 'path': f'/connectionPermissions/{connection_id}', 'value': 'READ'}],
        )
        if perm.status_code not in (200, 204):
            # Don't leave an unscoped (permission-less, effectively inert
            # but still-existing) user account behind on failure.
            self._request(
                'DELETE',
                f'{self.base_url}/api/session/data/{self.data_source}/users/{username}',
            )
            raise Exception(
                f'Failed to scope permissions for {username}: '
                f'{perm.status_code} {perm.text}'
            )
        return password

    def delete_scoped_user(self, connection_id):
        """Delete the scoped Guacamole user for a connection, if one
        exists. Called automatically from delete_connection() so scoped
        users never outlive the connection they were scoped to."""
        try:
            self._ensure_authenticated()
            username = self._scoped_username(connection_id)
            res = self._request(
                'DELETE',
                f'{self.base_url}/api/session/data/{self.data_source}/users/{username}',
            )
            if res.status_code not in (200, 204, 404):
                logger.warning(
                    "Failed to delete scoped Guacamole user %s: %s %s",
                    username, res.status_code, res.text,
                )
        except requests.RequestException as exc:
            logger.warning("Network error deleting scoped Guacamole user for connection %s: %s", connection_id, exc)

    def get_connection_url(self, connection_id):
        """
        Build a direct URL to open a Guacamole connection in the browser.

        SECURITY: real audit finding, confirmed with a live attack — this
        used to authenticate as the shared Guacamole ADMIN account and
        embed that token directly in the client-facing URL. Since a
        Guacamole token carries the full permission set of whoever it was
        issued for, ANY participant handed one of these URLs actually held
        an admin-level token: decoding the base64 identifier and swapping
        in a different connection_id (small sequential integers, e.g.
        199-264 observed in real testing) gave full read access to that
        connection's details via Guacamole's own REST API, and the same
        token could list EVERY connection on the entire server — a total
        breakdown of per-user VM isolation, not scoped to session
        participants but to every VM on the platform.

        Fix: authenticate as a dedicated, single-purpose Guacamole user
        that Guacamole's OWN permission system restricts to exactly this
        one connection_id (see _get_or_create_scoped_user). The token
        embedded in the returned URL is now genuinely incapable of
        reaching any other connection, regardless of what identifier a
        client tries to swap into the URL — Guacamole itself enforces it
        server-side, not just this app being careful about what it hands
        out.

        The Guacamole client identifier format is:
            base64( connection_id + NUL + 'c' + NUL + data_source )

        Args:
            connection_id (str): The connection identifier.

        Returns:
            str: Full URL to open this connection.
        """
        password = self._get_or_create_scoped_user(connection_id)
        username = self._scoped_username(connection_id)

        res = requests.post(
            f'{self.base_url}/api/tokens',
            data={'username': username, 'password': password},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if res.status_code != 200:
            logger.error(
                "Scoped Guacamole auth failed for %s: %s %s",
                username, res.status_code, res.text,
            )
            raise Exception(f'Failed to mint scoped access token: {res.status_code}')
        data = res.json()
        scoped_token = data['authToken']
        scoped_data_source = data['dataSource']

        identifier = f"{connection_id}\x00c\x00{scoped_data_source}"
        encoded = base64.b64encode(identifier.encode()).decode()
        return f'{GUACAMOLE_PUBLIC_URL}/#/client/{encoded}?token={scoped_token}'

    def get_active_connection_id(self, connection_id):
        """
        Find the active tunnel ID for a given connection.

        Args:
            connection_id (str): The Guacamole connection identifier.

        Returns:
            str or None: Active connection key, or None if not found.
        """
        self._ensure_authenticated()

        try:
            res = self._request(
                'GET',
                f'{self.base_url}/api/session/data/'
                f'{self.data_source}/activeConnections',
            )
            if res.status_code == 200:
                active_conns = res.json()
                for k, v in active_conns.items():
                    if str(v.get('connectionIdentifier')) == str(connection_id):
                        return k
        except Exception as exc:
            logger.error("Failed to get active connections: %s", exc)
        return None

    def get_share_link(self, active_connection_id, sharing_profile_id):
        """
        Generate a share link using an active connection and sharing profile.

        Args:
            active_connection_id (str): The active tunnel ID.
            sharing_profile_id (str): The sharing profile identifier.

        Returns:
            str or None: Full share URL, or None on failure.
        """
        self._ensure_authenticated()

        try:
            res = self._request(
                'GET',
                f'{self.base_url}/api/session/data/'
                f'{self.data_source}/activeConnections/'
                f'{active_connection_id}/sharingCredentials/'
                f'{sharing_profile_id}',
            )
            if res.status_code == 200:
                share_key = res.json().get('values', {}).get('key')
                if share_key:
                    identifier = f"{share_key}\x00c\x00{self.data_source}"
                    encoded = base64.b64encode(identifier.encode()).decode()
                    return (
                        f'{GUACAMOLE_PUBLIC_URL}/#/client/'
                        f'{encoded}?token={self.token}'
                    )
        except Exception as exc:
            logger.error("Failed to get share link: %s", exc)
        return None


def get_guacamole_service():
    """
    Factory function that returns a GuacamoleService instance.

    Defers construction so the module can be imported without
    requiring Guacamole credentials to be present.

    Returns:
        GuacamoleService: A ready-to-use service instance.
    """
    return GuacamoleService()
