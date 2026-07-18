"""
Proxmox API integration service.

All Proxmox API calls go through this single file. Uses the proxmoxer
library to communicate with Proxmox VE. Credentials are read from .env
via python-decouple — never hardcoded.

This service handles:
    - Cloning VM templates into new instances
    - Starting, stopping, and deleting VMs
    - Retrieving VM IP addresses via QEMU guest agent
    - Checking VM status
"""

from decouple import config
import time
import logging

logger = logging.getLogger(__name__)

# Proxmox connection constants (from .env)
PROXMOX_HOST = config('PROXMOX_HOST', default='')
PROXMOX_PORT = int(config('PROXMOX_PORT', default='8006'))
PROXMOX_USER = config('PROXMOX_USER', default='root@pam')
PROXMOX_TOKEN_NAME = config('PROXMOX_TOKEN_NAME', default='')
PROXMOX_TOKEN_SECRET = config('PROXMOX_TOKEN_SECRET', default='')
PROXMOX_NODE = config('PROXMOX_NODE', default='pve')
PROXMOX_VM_STORAGE = config('PROXMOX_VM_STORAGE', default='local-lvm')
PROXMOX_VERIFY_SSL = config('PROXMOX_VERIFY_SSL', default='False') == 'True'

# Timing constants
CLONE_WAIT_SECONDS = 3
IP_POLL_INTERVAL_SECONDS = 5
DEFAULT_MAX_WAIT_SECONDS = 60


class ProxmoxService:
    """
    Wraps all interactions with the Proxmox VE API.

    Attributes:
        host (str): Proxmox server hostname or IP.
        node (str): Proxmox node name (e.g. 'pve').
        storage (str): Default storage pool for cloned disks.
        proxmox: Authenticated ProxmoxAPI client instance.
    """

    def __init__(self):
        """
        Initialise the Proxmox API client.

        Reads credentials from environment variables. Connection is
        established lazily — no network call happens here.
        """
        self.host = PROXMOX_HOST
        self.node = PROXMOX_NODE
        self.storage = PROXMOX_VM_STORAGE
        self._client = None

    @property
    def proxmox(self):
        """
        Lazy-initialise the Proxmox API client.

        Returns:
            ProxmoxAPI: Authenticated client instance.

        Raises:
            ImportError: If proxmoxer is not installed.
            Exception: If connection/authentication fails.
        """
        if self._client is None:
            try:
                from proxmoxer import ProxmoxAPI
                self._client = ProxmoxAPI(
                    self.host,
                    port=PROXMOX_PORT,
                    user=PROXMOX_USER,
                    token_name=PROXMOX_TOKEN_NAME,
                    token_value=PROXMOX_TOKEN_SECRET,
                    verify_ssl=PROXMOX_VERIFY_SSL,
                    timeout=120,
                )
                logger.info("Connected to Proxmox at %s", self.host)
            except Exception as exc:
                logger.error("Failed to connect to Proxmox: %s", exc)
                raise
        return self._client

    def get_next_vmid(self):
        """
        Get the next available VM ID from the cluster.

        Returns:
            int: Next available VMID.
        """
        return int(self.proxmox.cluster.nextid.get())

    def clone_template(self, template_id, name):
        """
        Clone a Proxmox template into a new VM.

        Args:
            template_id (int): VMID of the template to clone.
            name (str): Name for the new VM.

        Returns:
            int: The VMID of the newly created clone.
        """
        new_vmid = self.get_next_vmid()

        upid = self.proxmox.nodes(self.node).qemu(template_id).clone.post(
            newid=new_vmid,
            name=name,
            full=1,  # full clone — linked clone not supported on this local-lvm
        )

        logger.info(
            "Cloned template %s -> VM %s (name: %s), UPID: %s",
            template_id, new_vmid, name, upid
        )

        # Wait for full clone to finish
        import time
        for _ in range(120):  # Wait up to 10 minutes (120 * 5s)
            try:
                task_status = self.proxmox.nodes(self.node).tasks(upid).status.get()
                if task_status.get("status") == "stopped":
                    if task_status.get("exitstatus") == "OK":
                        break
                    else:
                        raise Exception(f"Clone task failed: {task_status.get('exitstatus')}")
            except Exception as e:
                if "failed" in str(e).lower():
                    raise
            time.sleep(5)
            
        return int(new_vmid)

    def start_vm(self, vmid):
        """
        Start a VM by its VMID.

        Args:
            vmid (int): The Proxmox VM ID to start.
        """
        try:
            self.proxmox.nodes(self.node).qemu(vmid).config.post(agent=1)
        except Exception as e:
            logger.warning("Could not enable QEMU guest agent for VM %s: %s", vmid, str(e))
            
        self.proxmox.nodes(self.node).qemu(vmid).status.start.post()
        logger.info("Started VM %s", vmid)

    def stop_vm(self, vmid):
        """
        Stop a VM by its VMID.

        Args:
            vmid (int): The Proxmox VM ID to stop.
        """
        self.proxmox.nodes(self.node).qemu(vmid).status.stop.post()
        logger.info("Stopped VM %s", vmid)

    def delete_vm(self, vmid):
        """
        Delete a VM completely (stop first if running).

        Args:
            vmid (int): The Proxmox VM ID to delete.
        """
        try:
            self.stop_vm(vmid)
            time.sleep(CLONE_WAIT_SECONDS)
        except Exception:
            pass  # VM might already be stopped

        self.proxmox.nodes(self.node).qemu(vmid).delete()
        logger.info("Deleted VM %s", vmid)

    def get_vm_ip(self, vmid, max_wait=DEFAULT_MAX_WAIT_SECONDS):
        """
        Get the VM's IP address via the QEMU guest agent.

        Polls the guest agent network interfaces until a 192.168.x.x
        address is found, or the timeout is reached.

        Args:
            vmid (int): The Proxmox VM ID.
            max_wait (int): Maximum seconds to wait for an IP.

        Returns:
            str or None: The IP address, or None if not found in time.
        """
        waited = 0
        while waited < max_wait:
            try:
                result = (
                    self.proxmox
                    .nodes(self.node)
                    .qemu(vmid)
                    .agent
                    .get('network-get-interfaces')
                )

                for iface in result.get('result', []):
                    if iface.get('name') == 'lo':
                        continue
                    for ip_info in iface.get('ip-addresses', []):
                        addr = ip_info.get('ip-address', '')
                        if addr.startswith('192.168'):
                            logger.info("VM %s got IP: %s", vmid, addr)
                            return addr
            except Exception:
                pass  # Guest agent not ready yet

            time.sleep(IP_POLL_INTERVAL_SECONDS)
            waited += IP_POLL_INTERVAL_SECONDS

        logger.warning("VM %s did not get IP within %ss", vmid, max_wait)
        return None

    def get_vm_status(self, vmid):
        """
        Get the current status of a VM.

        Args:
            vmid (int): The Proxmox VM ID.

        Returns:
            str: Status string (e.g. 'running', 'stopped', 'unknown').
        """
        try:
            status = (
                self.proxmox
                .nodes(self.node)
                .qemu(vmid)
                .status.current.get()
            )
            return status.get('status', 'unknown')
        except Exception:
            return 'unknown'


def get_proxmox_service():
    import logging
    from decouple import config
    logger = logging.getLogger(__name__)
    logger.error(
        f'[DEBUG] PROXMOX_USER='
        f'{config("PROXMOX_USER", default="MISSING")} '
        f'TOKEN_NAME='
        f'{config("PROXMOX_TOKEN_NAME", default="MISSING")} '
        f'SECRET_LEN='
        f'{len(config("PROXMOX_TOKEN_SECRET", default=""))}'
    )
    return ProxmoxService()
