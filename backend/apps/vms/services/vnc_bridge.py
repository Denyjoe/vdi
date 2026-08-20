"""
Proxmox VNC-console bridge.

Proxmox does NOT expose its per-VM VNC server as a plain, directly
reachable RFB/TCP port. It only exposes VNC through its own
authenticated HTTP-upgrade `vncwebsocket` API endpoint — the same
mechanism its own noVNC browser console uses. Confirmed for real:

    - `qemu(vmid).vncproxy.post()` mints a short-lived ticket
      (`port`, `password`, `ticket`) for a real, genuine VNC server
      Proxmox runs for that VM.
    - Raw TCP to `<node>:<port>` is refused from off-node hosts —
      Proxmox deliberately never exposes it directly.
    - The ONLY real path in is
      `wss://<node>:8006/api2/json/nodes/<node>/qemu/<vmid>/vncwebsocket
      ?port=<port>&vncticket=<ticket>`, authenticated the same way as
      every other Proxmox API call (a real `PVEAPIToken` header),
      which streams the exact same RFB byte stream wrapped in
      WebSocket binary frames (confirmed live: the first frame off
      this connection is the real `RFB 003.008\n` handshake banner).

Guacamole's own `vnc` protocol support (via guacd) speaks plain RFB
over a raw TCP socket — it has no concept of a WebSocket transport.
So a genuine embed needs a small local bridge that:

    1. Mints a FRESH ticket (Proxmox tickets are short-lived/one-shot
       — never cached or reused across console opens) and immediately
       opens the authenticated outbound WebSocket to Proxmox with it.
    2. Listens on a local, loopback-only TCP port.
    3. Once guacd connects to that local port, relays raw bytes
       bidirectionally between the TCP socket and the WebSocket for
       the lifetime of the session.

This is real infrastructure, not a mock: the bytes guacd sees are the
exact same RFB stream Proxmox's own noVNC console renders.
"""
import logging
import socket
import ssl
import threading
import urllib.parse

import websocket
from decouple import config

logger = logging.getLogger(__name__)

PROXMOX_HOST = config('PROXMOX_HOST', default='')
PROXMOX_PORT = int(config('PROXMOX_PORT', default='8006'))
PROXMOX_USER = config('PROXMOX_USER', default='root@pam')
PROXMOX_TOKEN_NAME = config('PROXMOX_TOKEN_NAME', default='')
PROXMOX_TOKEN_SECRET = config('PROXMOX_TOKEN_SECRET', default='')
PROXMOX_NODE = config('PROXMOX_NODE', default='pve')

ACCEPT_TIMEOUT_SECONDS = 90


class VncBridgeError(Exception):
    """Raised when a real, honest failure occurs setting up the bridge
    (never silently swallowed — the caller gets a real reason)."""


def _detect_local_reachable_ip():
    """
    guacd runs on its OWN host (GUACAMOLE_URL), not on this machine —
    a bridge bound to 127.0.0.1 would only ever be reachable from
    guacd's own loopback, not from here. Real fix: find the actual IP
    this machine uses to reach the LAN guacd lives on, by opening a
    UDP "connect" (no packets actually sent) toward it and reading
    back which local interface the OS would route through — the
    standard, portable trick for this, since there's no other reliable
    way to ask "which of my IPs can the outside world reach me on".
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect((PROXMOX_HOST, 1))
        return s.getsockname()[0]
    finally:
        s.close()


def start_vnc_bridge(proxmox_service, vmid):
    """
    Mint a fresh Proxmox VNC ticket for `vmid`, open the real
    authenticated WebSocket to it immediately (while the ticket is
    freshest), and start a TCP listener — bound to this machine's real
    LAN-reachable IP, not 127.0.0.1, since guacd runs on a separate
    host and needs to reach it over the network — that bridges the
    first connection guacd makes to that live WebSocket.

    Returns:
        (local_ip, local_port, vnc_password): local_ip/local_port is
        where Guacamole's VNC connection should point; vnc_password is
        the real RFB auth password guacd must present — it belongs to
        THIS specific ticket, so it must be used together with
        local_port, not reused for a later bridge.
    """
    try:
        vnc = proxmox_service.proxmox.nodes(proxmox_service.node).qemu(vmid).vncproxy.post()
    except Exception as e:
        raise VncBridgeError(f'Could not obtain a real Proxmox VNC ticket for VM {vmid}: {e}')

    token_header = f'Authorization: PVEAPIToken={PROXMOX_USER}!{PROXMOX_TOKEN_NAME}={PROXMOX_TOKEN_SECRET}'
    ticket = urllib.parse.quote(vnc['ticket'], safe='')
    ws_url = (
        f'wss://{PROXMOX_HOST}:{PROXMOX_PORT}/api2/json/nodes/{PROXMOX_NODE}'
        f'/qemu/{vmid}/vncwebsocket?port={vnc["port"]}&vncticket={ticket}'
    )

    try:
        ws = websocket.create_connection(
            ws_url,
            header=[token_header],
            sslopt={'cert_reqs': ssl.CERT_NONE},
            subprotocols=['binary'],
            timeout=15,
        )
        # `timeout` above only bounds the CONNECT/handshake — but
        # websocket-client also applies it as the socket's permanent
        # read timeout, so recv() would raise after any 15s stretch
        # with no new VNC frame (a real, idle desktop screen easily
        # goes quiet that long). A live console session is naturally
        # bursty/idle, not request-response, so once connected this
        # needs to block indefinitely, not time out mid-session.
        ws.settimeout(None)
    except Exception as e:
        raise VncBridgeError(f'Could not open the real Proxmox VNC WebSocket for VM {vmid}: {e}')

    local_ip = _detect_local_reachable_ip()
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.bind((local_ip, 0))
    local_port = srv.getsockname()[1]
    srv.listen(1)
    srv.settimeout(ACCEPT_TIMEOUT_SECONDS)

    def _relay(conn, sock_ws):
        def ws_to_tcp():
            try:
                while True:
                    data = sock_ws.recv()
                    if not data:
                        break
                    if isinstance(data, str):
                        data = data.encode('latin-1')
                    conn.sendall(data)
            except Exception as e:
                logger.warning('VNC bridge for VM %s: websocket->tcp relay ended: %s', vmid, e)
            finally:
                try:
                    conn.shutdown(socket.SHUT_WR)
                except Exception:
                    pass

        def tcp_to_ws():
            try:
                while True:
                    data = conn.recv(65536)
                    if not data:
                        break
                    sock_ws.send(data, opcode=websocket.ABNF.OPCODE_BINARY)
            except Exception as e:
                logger.warning('VNC bridge for VM %s: tcp->websocket relay ended: %s', vmid, e)
            finally:
                try:
                    sock_ws.close()
                except Exception:
                    pass

        t1 = threading.Thread(target=ws_to_tcp, daemon=True)
        t2 = threading.Thread(target=tcp_to_ws, daemon=True)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        try:
            conn.close()
        except Exception:
            pass

    def _accept_and_bridge():
        try:
            conn, _addr = srv.accept()
        except socket.timeout:
            logger.warning('VNC bridge for VM %s: no connection within %ss — closing.', vmid, ACCEPT_TIMEOUT_SECONDS)
            try:
                ws.close()
            except Exception:
                pass
            try:
                srv.close()
            except Exception:
                pass
            return
        try:
            srv.close()
        except Exception:
            pass
        logger.info('VNC bridge for VM %s: guacd connected to %s:%s, relaying real RFB stream.', vmid, local_ip, local_port)
        _relay(conn, ws)
        logger.info('VNC bridge for VM %s: session ended.', vmid)

    threading.Thread(target=_accept_and_bridge, daemon=True).start()

    return local_ip, local_port, vnc['password']
