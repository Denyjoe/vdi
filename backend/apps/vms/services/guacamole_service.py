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

    def get_connection_url(self, connection_id):
        """
        Build a direct URL to open a Guacamole connection in the browser.

        The Guacamole client identifier format is:
            base64( connection_id + NUL + 'c' + NUL + data_source )

        Unlike a plain string-format method, this makes a real (cheap)
        authenticated request first so a stale cached token gets caught
        and refreshed via _request()'s retry-on-401 logic — otherwise a
        dead token would be silently baked into the URL and the embedded
        client would fall back to Guacamole's own login screen with no
        way for the app to detect or recover from it.

        Args:
            connection_id (str): The connection identifier.

        Returns:
            str: Full URL to open this connection.
        """
        self._request(
            'GET',
            f'{self.base_url}/api/session/data/'
            f'{self.data_source}/connections/{connection_id}',
        )

        identifier = f"{connection_id}\x00c\x00{self.data_source}"
        encoded = base64.b64encode(identifier.encode()).decode()
        return f'{GUACAMOLE_PUBLIC_URL}/#/client/{encoded}?token={self.token}'

    def get_active_connection_id(self, connection_id):
        """
        Find the active tunnel ID for a given connection.

        Args:
            connection_id (str): The Guacamole connection identifier.

        Returns:
            str or None: Active connection key, or None if not found.
        """
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
