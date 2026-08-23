"""
Phase 1 (Product Depth Layer) — real hardware quota tracking and
enforcement for university-scoped resources.

Real, not an estimate: every VMTemplate's cpu_cores/ram_gb/storage_gb is
the exact spec it was created with in Proxmox (the same fields every
other real code path in this app already treats as authoritative —
pricing, provisioning, the catalogue UI). For currently-running clones,
this module goes one step further and cross-checks each candidate VM's
real, live Proxmox power state (reusing the same reconciliation pattern
as Infrastructure Health / apps.vms.services.reconciliation_service)
rather than blindly trusting the DB's cached 'running' status — so a VM
that crashed or was manually stopped on the hypervisor without the DB
noticing doesn't keep counting against quota forever.

A university's usage is the sum of:
  - every VMTemplate scoped to it (a template is a real, persistent
    Proxmox object occupying real disk even when never launched), plus
  - every currently, genuinely-running VM cloned from one of those
    templates (real, active vCPU/RAM/disk load).
"""
import logging

logger = logging.getLogger(__name__)


def get_university_resource_usage(university):
    """Real, live vCPU/RAM/storage usage for one university.

    Returns:
        {
            'vcpu_used': int, 'vcpu_max': int,
            'ram_gb_used': int, 'ram_gb_max': int,
            'storage_gb_used': int, 'storage_gb_max': int,
            'percent_used': {'vcpu': float, 'ram_gb': float, 'storage_gb': float},
            'templates': [ {id, name, cpu_cores, ram_gb, storage_gb} ],
            'running_vms': [ {id, name, cpu_cores, ram_gb, storage_gb, owner_email} ],
            'proxmox_reachable': bool,
        }
    """
    from apps.vms.models import VMTemplate, VirtualMachine

    templates = list(VMTemplate.objects.filter(university=university))
    template_vcpu = sum(t.cpu_cores for t in templates)
    template_ram = sum(t.ram_gb for t in templates)
    template_storage = sum(t.storage_gb for t in templates)

    candidate_vms = list(
        VirtualMachine.objects.filter(template__university=university, status='running')
        .select_related('template', 'owner')
    )

    proxmox_reachable = True
    running_vcpu = running_ram = running_storage = 0
    genuinely_running = []

    if candidate_vms:
        try:
            from apps.vms.services.proxmox_service import get_proxmox_service
            ps = get_proxmox_service()
            node = ps.proxmox.nodes(ps.node)
        except Exception as e:
            logger.warning("Quota check: could not reach Proxmox to verify running VMs: %s", e)
            proxmox_reachable = False
            node = None

        for vm in candidate_vms:
            if not vm.template:
                continue
            is_really_running = True  # default: trust the DB if Proxmox can't be reached
            if node is not None and vm.proxmox_vm_id:
                try:
                    real_status = node.qemu(vm.proxmox_vm_id).status.current.get()
                    is_really_running = real_status.get('status') == 'running'
                except Exception as e:
                    logger.warning(
                        "Quota check: could not verify real Proxmox status for VM %s: %s",
                        vm.proxmox_vm_id, e,
                    )
                    proxmox_reachable = False
            if is_really_running:
                running_vcpu += vm.template.cpu_cores
                running_ram += vm.template.ram_gb
                running_storage += vm.template.storage_gb
                genuinely_running.append(vm)

    vcpu_used = template_vcpu + running_vcpu
    ram_used = template_ram + running_ram
    storage_used = template_storage + running_storage

    def _pct(used, max_val):
        return round((used / max_val) * 100, 1) if max_val else 0.0

    return {
        'vcpu_used': vcpu_used,
        'vcpu_max': university.max_vcpu_cores,
        'ram_gb_used': ram_used,
        'ram_gb_max': university.max_ram_gb,
        'storage_gb_used': storage_used,
        'storage_gb_max': university.max_storage_gb,
        'percent_used': {
            'vcpu': _pct(vcpu_used, university.max_vcpu_cores),
            'ram_gb': _pct(ram_used, university.max_ram_gb),
            'storage_gb': _pct(storage_used, university.max_storage_gb),
        },
        'templates': [
            {'id': t.id, 'name': t.name, 'cpu_cores': t.cpu_cores, 'ram_gb': t.ram_gb, 'storage_gb': t.storage_gb}
            for t in templates
        ],
        'running_vms': [
            {
                'id': vm.id, 'name': vm.name,
                'cpu_cores': vm.template.cpu_cores, 'ram_gb': vm.template.ram_gb, 'storage_gb': vm.template.storage_gb,
                'owner_email': vm.owner.email if vm.owner else None,
                'template_name': vm.template.name,
            }
            for vm in genuinely_running
        ],
        'proxmox_reachable': proxmox_reachable,
    }


def check_university_active(university):
    """Real pre-flight check: is this university currently allowed to
    operate at all? A suspended university's real users are immediately
    blocked from launching NEW workspaces/sessions — reused at the SAME
    two enforcement points as check_quota_allows (workspace/session
    launch, template creation), checked BEFORE quota so a suspended
    university gets an honest "you're suspended" message rather than a
    misleading quota one. Existing running VMs are left alone —
    suspension pauses new activity, it isn't a kill switch.

    Returns (allowed: bool, message: str).
    """
    if university.status != 'active':
        return False, (
            f"{university.name} is currently {university.get_status_display().lower()} — "
            f"new workspace and session launches are paused. Contact your platform administrator."
        )
    return True, 'Active.'


def check_quota_allows(university, additional_vcpu=0, additional_ram_gb=0, additional_storage_gb=0):
    """Real pre-flight check: would adding this many resources push the
    university over its real, approved ceiling? Used at BOTH real
    enforcement points — university-scoped template creation, and
    workspace/session launch against a university-scoped template.

    Returns (allowed: bool, message: str) — message is always a real,
    specific explanation (how much room remains), never a bare boolean.
    """
    usage = get_university_resource_usage(university)

    checks = [
        ('vCPU', additional_vcpu, usage['vcpu_used'], usage['vcpu_max']),
        ('RAM', additional_ram_gb, usage['ram_gb_used'], usage['ram_gb_max'], 'GB'),
        ('storage', additional_storage_gb, usage['storage_gb_used'], usage['storage_gb_max'], 'GB'),
    ]

    for check in checks:
        label, additional, used, max_val = check[0], check[1], check[2], check[3]
        unit = check[4] if len(check) > 4 else ''
        if additional <= 0:
            continue
        remaining = max_val - used
        if additional > remaining:
            return False, (
                f'This would exceed the university\'s {label} quota: '
                f'{used}{unit}/{max_val}{unit} already used, only {max(remaining, 0)}{unit} remaining, '
                f'but this needs {additional}{unit} more.'
            )

    return True, 'Within quota.'
