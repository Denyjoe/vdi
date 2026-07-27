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
        self.base_url = GUACAMOLE_URL
        self.admin_user = GUACAMOLE_ADMIN_USER
        self.admin_pass = GUACAMOLE_ADMIN_PASSWORD
        self.token = None
        self.data_source = None

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


def get_guacamole_service():
    """
    Factory function that returns a GuacamoleService instance.

    Defers construction so the module can be imported without
    requiring Guacamole credentials to be present.

    Returns:
        GuacamoleService: A ready-to-use service instance.
    """
    return GuacamoleService()
