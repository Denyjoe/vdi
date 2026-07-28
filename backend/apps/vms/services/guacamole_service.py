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

    def authenticate(self):
        """
        Obtain a Guacamole auth token.

        Returns:
            bool: True if authentication succeeded.
        """
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
                from django.core.cache import cache
                cache.set('guac_admin_token', self.token, timeout=3000)
                cache.set('guac_admin_data_source', self.data_source, timeout=3000)
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
        from django.core.cache import cache
        self.token = cache.get('guac_admin_token')
        self.data_source = cache.get('guac_admin_data_source')
        if not self.token:
            self.authenticate()

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
            res = requests.post(
                f'{self.base_url}/api/session/data/'
                f'{self.data_source}/connections',
                params={'token': self.token},
                json=payload,
                timeout=REQUEST_TIMEOUT_SECONDS,
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
        """
        self._ensure_authenticated()

        res = requests.delete(
            f'{self.base_url}/api/session/data/'
            f'{self.data_source}/connections/{connection_id}',
            params={'token': self.token},
            timeout=REQUEST_TIMEOUT_SECONDS,
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
        """
        self._ensure_authenticated()
        
        profile_name = f'shadow-{connection_id}-{"ro" if read_only else "rw"}'
        
        # STEP 1: Check if a profile already exists for this exact connection.
        # Always match by primaryConnectionIdentifier + name to avoid returning a
        # stale profile that belongs to a different (previous) connection.
        try:
            list_res = requests.get(
                f'{self.base_url}/api/session/data/{self.data_source}/sharingProfiles',
                params={'token': self.token},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            if list_res.status_code == 200:
                for k, v in list_res.json().items():
                    if (str(v.get('primaryConnectionIdentifier')) == str(connection_id)
                            and v.get('name') == profile_name):
                        logger.info("Reusing existing sharing profile %s for connection %s", k, connection_id)
                        return k
        except requests.RequestException as exc:
            logger.warning("Could not list sharing profiles, will attempt create: %s", exc)
        
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
            res = requests.post(
                f'{self.base_url}/api/session/data/'
                f'{self.data_source}/sharingProfiles',
                params={'token': self.token},
                json=payload,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            
            if res.status_code in [200, 201]:
                identifier = res.json().get('identifier')
                logger.info(
                    "Created Guacamole sharing profile %s for connection %s (read_only=%s)",
                    identifier, connection_id, read_only
                )
                return identifier
                            
            logger.error(
                "Guacamole create sharing profile failed: %s %s",
                res.status_code, res.text
            )
            raise Exception(
                f'Failed to create sharing profile: {res.status_code} {res.text}'
            )
        except requests.RequestException as exc:
            logger.error("Guacamole create sharing profile error: %s", exc)
            raise Exception(f'Network error creating sharing profile: {exc}')

    def get_connection_url(self, connection_id):
        """
        Build a direct URL to open a Guacamole connection in the browser.

        The Guacamole client identifier format is:
            base64( connection_id + NUL + 'c' + NUL + data_source )

        Args:
            connection_id (str): The connection identifier.

        Returns:
            str: Full URL to open this connection.
        """
        self._ensure_authenticated()

        identifier = f"{connection_id}\x00c\x00{self.data_source}"
        encoded = base64.b64encode(identifier.encode()).decode()
        return f'{GUACAMOLE_PUBLIC_URL}/#/client/{encoded}?token={self.token}'

    def get_active_connection_id(self, connection_id):
        """Find the active connection ID for a given connection."""
        self._ensure_authenticated()
        try:
            res = requests.get(
                f'{self.base_url}/api/session/data/{self.data_source}/activeConnections',
                params={'token': self.token},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            if res.status_code == 200:
                active_conns = res.json()
                for k, v in active_conns.items():
                    if str(v.get('connectionIdentifier')) == str(connection_id):
                        return k
        except Exception as e:
            logger.error("Failed to get active connections: %s", e)
        return None

    def get_share_link(self, active_connection_id, sharing_profile_id):
        """Generate a share link using an active connection and a sharing profile."""
        self._ensure_authenticated()
        try:
            res = requests.get(
                f'{self.base_url}/api/session/data/{self.data_source}/activeConnections/{active_connection_id}/sharingCredentials/{sharing_profile_id}',
                params={'token': self.token},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            if res.status_code == 200:
                share_key = res.json().get('values', {}).get('key')
                if share_key:
                    identifier = f"{share_key}\x00c\x00{self.data_source}"
                    encoded = base64.b64encode(identifier.encode()).decode()
                    return f'{GUACAMOLE_PUBLIC_URL}/#/client/{encoded}?token={self.token}'
        except Exception as e:
            logger.error("Failed to get share link: %s", e)
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
