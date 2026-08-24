"""
Real, confirmed root cause of the recurring "Couldn't establish the
real install console after several attempts" failures — investigated
fresh, not assumed to be a repeat of the earlier client-side
onReadyChange gap.

Confirmed live via Proxmox's own real task log for the user's actual
stuck job (vmid 9033): up to 7 separate vncproxy tasks fired within a
2-minute window, at ~14s/~6s intervals matching the wizard's own
connect-watchdog retry cadence, several with task durations that
genuinely overlap in time (multiple real, live VNC sessions open
concurrently against the same VM), and one real vncproxy task recorded
status="connection timed out". Root cause: every start_vnc_bridge()
call — including every automatic retry — used to mint a brand-new
real, authenticated Proxmox VNC WebSocket with zero awareness of any
earlier bridge for the same vmid, leaving the old one's real WebSocket
open to Proxmox for up to 90 real seconds even though nothing would
ever connect to its local listener again.

These tests prove the fix directly: only the module-level bridge
registry and its force-teardown behavior are under test here (the
actual Proxmox/websocket network calls are faked at the same
module-import boundary vnc_bridge.py itself uses — the real bug was a
pure concurrency/bookkeeping error, independent of any specific live
Proxmox response, matching the same testing philosophy already
established for get_next_vmid()). Real, live multi-cycle verification
against the user's actual job is covered separately via the browser.
"""
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from apps.vms.services import vnc_bridge


class _FakeProxmoxNode:
    def __init__(self, tickets_by_vmid):
        self._tickets_by_vmid = tickets_by_vmid
        self._vmid = None

    def qemu(self, vmid):
        self._vmid = vmid
        return self

    @property
    def vncproxy(self):
        return self

    def post(self):
        return dict(self._tickets_by_vmid[self._vmid])


class _FakeProxmoxService:
    """Mirrors the real ProxmoxService's shape just enough for
    start_vnc_bridge()'s own real usage: self.node and
    self.proxmox.nodes(node).qemu(vmid).vncproxy.post()."""

    def __init__(self, tickets_by_vmid):
        self.node = 'pve'
        self._node_obj = _FakeProxmoxNode(tickets_by_vmid)

    @property
    def proxmox(self):
        return self

    def nodes(self, node):
        return self._node_obj


class VncBridgeLeakFixTests(SimpleTestCase):
    def setUp(self):
        # Real module-level registry — clear it between tests so one
        # test's leftover state can never bleed into another.
        vnc_bridge._active_bridges.clear()

    def tearDown(self):
        vnc_bridge._active_bridges.clear()

    @patch('apps.vms.services.vnc_bridge.threading.Thread')
    @patch('apps.vms.services.vnc_bridge.websocket.create_connection')
    def test_second_call_for_same_vmid_force_closes_the_first_real_websocket(self, mock_create_conn, mock_thread):
        ws1, ws2 = MagicMock(), MagicMock()
        mock_create_conn.side_effect = [ws1, ws2]
        ps = _FakeProxmoxService({42: {'ticket': 't1', 'password': 'p1', 'port': '5900'}})

        ip1, port1, pw1, superseded1 = vnc_bridge.start_vnc_bridge(ps, 42)
        self.assertIsNone(superseded1)
        ws1.close.assert_not_called()

        ip2, port2, pw2, superseded2 = vnc_bridge.start_vnc_bridge(ps, 42)
        # The real fix: the FIRST bridge's real websocket must be
        # force-closed the instant a second one starts for the same
        # vmid — never left open for the old 90s accept-timeout.
        ws1.close.assert_called_once()
        ws2.close.assert_not_called()
        self.assertNotEqual(port1, port2)

    @patch('apps.vms.services.vnc_bridge.threading.Thread')
    @patch('apps.vms.services.vnc_bridge.websocket.create_connection')
    def test_five_rapid_retries_never_leave_more_than_one_real_websocket_open(self, mock_create_conn, mock_thread):
        # Directly reproduces the real, observed pattern: the
        # connect-watchdog retrying every ~14s. Proves the degrade-
        # after-repeated-use case the earlier fix's test proof needed —
        # a fix proven once but failing on the 3rd/4th real use would
        # just be this same bug again.
        wss = [MagicMock() for _ in range(5)]
        mock_create_conn.side_effect = wss
        ps = _FakeProxmoxService({11: {'ticket': 't', 'password': 'p', 'port': '5900'}})

        for _ in range(5):
            vnc_bridge.start_vnc_bridge(ps, 11)

        for ws in wss[:-1]:
            ws.close.assert_called_once()
        wss[-1].close.assert_not_called()
        # Exactly one real bridge left registered/alive, not five.
        self.assertEqual(len(vnc_bridge._active_bridges), 1)

    @patch('apps.vms.services.vnc_bridge.threading.Thread')
    @patch('apps.vms.services.vnc_bridge.websocket.create_connection')
    def test_superseded_guac_connection_id_is_returned_for_cleanup(self, mock_create_conn, mock_thread):
        mock_create_conn.side_effect = [MagicMock(), MagicMock()]
        ps = _FakeProxmoxService({7: {'ticket': 't', 'password': 'p', 'port': '5900'}})

        vnc_bridge.start_vnc_bridge(ps, 7)
        vnc_bridge.register_guac_connection(7, 'guac-conn-abc')

        _, _, _, superseded = vnc_bridge.start_vnc_bridge(ps, 7)
        self.assertEqual(superseded, 'guac-conn-abc')

    @patch('apps.vms.services.vnc_bridge.threading.Thread')
    @patch('apps.vms.services.vnc_bridge.websocket.create_connection')
    def test_close_active_bridge_for_vmid_tears_down_and_returns_connection_id(self, mock_create_conn, mock_thread):
        ws = MagicMock()
        mock_create_conn.return_value = ws
        ps = _FakeProxmoxService({9: {'ticket': 't', 'password': 'p', 'port': '5900'}})

        vnc_bridge.start_vnc_bridge(ps, 9)
        vnc_bridge.register_guac_connection(9, 'guac-xyz')

        result = vnc_bridge.close_active_bridge_for_vmid(9)
        self.assertEqual(result, 'guac-xyz')
        ws.close.assert_called_once()
        # Idempotent — a second close on an already-gone vmid is a
        # real, honest no-op (None), never an error.
        self.assertIsNone(vnc_bridge.close_active_bridge_for_vmid(9))

    @patch('apps.vms.services.vnc_bridge.threading.Thread')
    @patch('apps.vms.services.vnc_bridge.websocket.create_connection')
    def test_different_vmids_never_interfere_with_each_others_bridges(self, mock_create_conn, mock_thread):
        ws_a, ws_b = MagicMock(), MagicMock()
        mock_create_conn.side_effect = [ws_a, ws_b]
        ps = _FakeProxmoxService({
            101: {'ticket': 'ta', 'password': 'pa', 'port': '5900'},
            202: {'ticket': 'tb', 'password': 'pb', 'port': '5901'},
        })

        vnc_bridge.start_vnc_bridge(ps, 101)
        vnc_bridge.start_vnc_bridge(ps, 202)

        # A bridge for a DIFFERENT vmid must never be torn down just
        # because another vmid's bridge started — this is per-vmid
        # state, not a single global slot.
        ws_a.close.assert_not_called()
        ws_b.close.assert_not_called()
        self.assertEqual(len(vnc_bridge._active_bridges), 2)
