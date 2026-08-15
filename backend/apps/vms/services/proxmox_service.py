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
        """Get the next available Proxmox VM ID."""
        vms = self.proxmox.nodes(self.node).qemu.get()
        existing_ids = [int(v.get('vmid')) for v in vms]
        if not existing_ids:
            return 110
        max_id = max(existing_ids)
        if max_id < 110:
            return 110
        return max_id + 1

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
        logger.info(f"[DEBUG] Starting clone.post for {new_vmid}...")

        try:
            upid = self.proxmox.nodes(self.node).qemu(template_id).clone.post(
                newid=new_vmid,
                name=name,
                full=0,  # linked clone — supported and dramatically faster on LVM-thin
            )
        except Exception as e:
            logger.info(f"[DEBUG] clone.post failed: {e}")
            raise

        logger.info(
            "Cloned template %s -> VM %s (name: %s), UPID: %s",
            template_id, new_vmid, name, upid
        )

        # Wait for full clone to finish
        import time
        for i in range(120):  # Wait up to 10 minutes (120 * 5s)
            try:
                task_status = self.proxmox.nodes(self.node).tasks(upid).status.get()
                logger.info(f"[DEBUG] Poll {i}: {task_status}")
                if task_status.get("status") == "stopped":
                    if task_status.get("exitstatus") == "OK":
                        break
                    else:
                        raise Exception(f"Clone task failed: {task_status.get('exitstatus')}")
            except Exception as e:
                logger.info(f"[DEBUG] Poll exception {i}: {e}")
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

    def wait_for_task(self, upid, timeout=60, poll_interval=2):
        """Poll a Proxmox task UPID until it completes.
        Returns True if successful, raises Exception if it failed or timed out.
        """
        import time
        elapsed = 0
        while elapsed < timeout:
            try:
                status = self.proxmox.nodes(self.node).tasks(upid).status.get()
                
                if status.get('status') == 'stopped':
                    exitstatus = status.get('exitstatus', '')
                    if exitstatus == 'OK':
                        return True
                    else:
                        raise Exception(f'Task failed: {exitstatus}')
            except Exception as e:
                if 'Task failed' in str(e):
                    raise
                # Task might not be queryable yet, keep trying
            
            time.sleep(poll_interval)
            elapsed += poll_interval
        
        raise Exception(f'Task {upid} timed out after {timeout}s')

    def delete_vm_completely(self, vmid):
        """Stop and delete a VM, waiting for each step to actually complete.
        Gracefully handles the case where the VM is already gone."""
        
        try:
            status = self.proxmox.nodes(self.node).qemu(vmid).status.current.get()
        except Exception as e:
            error_str = str(e).lower()
            if 'does not exist' in error_str or ('500' in error_str and 'config' in error_str):
                # VM already doesn't exist — this is the desired end state
                import logging
                logger = logging.getLogger(__name__)
                logger.info(
                    f'VM {vmid} already does not exist in Proxmox — '
                    f'treating as already deleted'
                )
                return True
            raise
        
        if status.get('status') == 'running':
            stop_upid = self.proxmox.nodes(self.node).qemu(vmid).status.stop.post()
            self.wait_for_task(stop_upid, timeout=30)
        
        # Now genuinely wait a moment for the lock to release after stop completes
        import time
        time.sleep(3)
        
        try:
            # Delete and WAIT for the delete task to actually finish
            delete_upid = self.proxmox.nodes(self.node).qemu(vmid).delete()
            self.wait_for_task(delete_upid, timeout=60)
        except Exception as e:
            error_str = str(e).lower()
            if 'does not exist' in error_str:
                # Already gone, treat as success
                return True
            raise
        
        return True

    def delete_vm(self, vmid):
        """
        Delete a VM completely (legacy wrapper).
        """
        self.delete_vm_completely(vmid)
        logger.info("Deleted VM %s", vmid)

    def get_vm_ip(self, vmid, max_wait=DEFAULT_MAX_WAIT_SECONDS, progress_callback=None):
        """
        Get the VM's IP address via the QEMU guest agent.

        Polls the guest agent network interfaces until a 192.168.x.x
        address is found, or the timeout is reached.

        Args:
            vmid (int): The Proxmox VM ID.
            max_wait (int): Maximum seconds to wait for an IP.
            progress_callback (callable): Optional callback for progress.

        Returns:
            str or None: The IP address, or None if not found in time.
        """
        waited = 0
        while waited < max_wait:
            if progress_callback:
                progress_callback(waited)
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

    def enable_vm_lockdown(self, vmid, allowed_domains=None):
        """
        Lock a VM down to no outbound internet access except essential
        gateway/DNS traffic and an optional domain whitelist.

        Rebuilds the VM's firewall rule set from scratch every call, so
        it is safe to call repeatedly (e.g. re-applied after a resume).

        Essential connectivity is a single ACCEPT rule for the platform's
        LAN gateway (also the real DNS server in this environment — see
        SystemConfig key 'network_lockdown_allowlist_ips'). Guacamole and
        Proxmox are deliberately NOT whitelisted: Guacamole connects
        INBOUND to the VM (governed by policy_in=ACCEPT, not outbound
        rules) and the guest agent uses QEMU's virtio-serial channel, not
        the network, so neither needs an outbound path from the guest.

        Domain whitelisting resolves each domain to its current IP(s) at
        activation time and adds one ACCEPT rule per IP. This is a
        snapshot: a domain that later answers with a different IP (e.g.
        a multi-IP CDN rotating addresses) will not be reachable until
        lockdown is re-applied. This is an inherent limitation of
        IP-based firewalling, not a bug.

        Args:
            vmid (int): The Proxmox VM ID to lock down.
            allowed_domains (list[str] or None): Domains to whitelist in
                addition to the essential gateway/DNS access.
        """
        import socket
        from apps.users.models import SystemConfig

        node = self.proxmox.nodes(self.node)

        # Per-VM rules only take effect if the interface opts in.
        cfg = node.qemu(vmid).config.get()
        net0 = cfg.get('net0', '')
        if net0 and 'firewall=1' not in net0:
            node.qemu(vmid).config.post(net0=net0 + ',firewall=1')

        # Rebuild from a clean slate so re-applying (e.g. after resume)
        # never stacks duplicate or stale rules.
        existing_rules = node.qemu(vmid).firewall.rules.get()
        for _ in existing_rules:
            node.qemu(vmid).firewall.rules(0).delete()

        essential_ips = [
            ip.strip() for ip in
            SystemConfig.get('network_lockdown_allowlist_ips', '192.168.1.1').split(',')
            if ip.strip()
        ]
        for ip in essential_ips:
            node.qemu(vmid).firewall.rules.post(
                type='out', action='ACCEPT', dest=ip, enable=1,
                comment='Essential gateway/DNS connectivity',
            )

        resolved_ips = set()
        for domain in (allowed_domains or []):
            domain = domain.strip()
            if not domain:
                continue
            try:
                addrinfo = socket.getaddrinfo(domain, None, socket.AF_INET)
                domain_ips = {info[4][0] for info in addrinfo}
            except socket.gaierror as e:
                logger.warning("Could not resolve whitelisted domain %s: %s", domain, e)
                continue
            for ip in domain_ips:
                if ip in resolved_ips:
                    continue
                resolved_ips.add(ip)
                node.qemu(vmid).firewall.rules.post(
                    type='out', action='ACCEPT', dest=ip, enable=1,
                    comment=f'Whitelisted domain: {domain}',
                )

        node.qemu(vmid).firewall.options.put(
            enable=1, policy_in='ACCEPT', policy_out='DROP',
        )
        logger.info(
            "Network lockdown enabled on VM %s (essential=%s, domains=%s -> %s)",
            vmid, essential_ips, allowed_domains, sorted(resolved_ips),
        )

    def disable_vm_lockdown(self, vmid):
        """
        Fully lift network lockdown on a VM, restoring unrestricted
        outbound access.

        Args:
            vmid (int): The Proxmox VM ID to unlock.
        """
        node = self.proxmox.nodes(self.node)
        node.qemu(vmid).firewall.options.put(enable=0)

        existing_rules = node.qemu(vmid).firewall.rules.get()
        for _ in existing_rules:
            node.qemu(vmid).firewall.rules(0).delete()

        logger.info("Network lockdown disabled on VM %s", vmid)

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
