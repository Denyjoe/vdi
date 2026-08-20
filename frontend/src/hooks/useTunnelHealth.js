import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

// Same proven pattern as DesktopSessionPage.jsx's evaluateTunnelHealth:
// Guacamole marks a tunnel "active" the instant guacd accepts a client,
// before the real VNC/RDP handshake to the actual VM has succeeded or
// failed — a single positive reading is not trusted. Two consecutive
// positive polls are required before ever reporting the tunnel as up;
// a single negative reading immediately reports it down (fail fast on
// the way down, more conservative on the way up).
const CONFIRM_STRIKES = 2;
const POLL_INTERVAL_MS = 2000;

/**
 * Real, live-polled "does Guacamole currently have a live tunnel for
 * this connection_id" signal — the admin-wizard/Infrastructure-Health
 * equivalent of VirtualMachineSerializer.get_guac_connected(), just
 * addressed directly by connection_id since these ad-hoc console/
 * terminal connections aren't backed by a VirtualMachine row. Meant to
 * be wired straight into GuacamoleEmbed's `tunnelActive` prop — never
 * pass a hardcoded `true` there, since that defeats the cover entirely
 * and lets Guacamole's own raw UI text leak through during a real
 * connect failure.
 *
 * @param {string|null} connectionId - Guacamole connection identifier,
 *   or null/undefined while no connection has been opened yet.
 * @returns {boolean} tunnelActive
 */
export default function useTunnelHealth(connectionId) {
  const [tunnelActive, setTunnelActive] = useState(false);
  const upStrikesRef = useRef(0);

  useEffect(() => {
    setTunnelActive(false);
    upStrikesRef.current = 0;
    if (!connectionId) return undefined;

    let cancelled = false;

    const poll = async () => {
      let active = false;
      try {
        const r = await api.get('/admin/templates/connection-status/', { params: { connection_id: connectionId } });
        active = !!r.data?.data?.active;
      } catch (e) {
        // A failed poll is not confirmed-healthy — treat it the same
        // as an explicit negative reading rather than ignoring it.
        active = false;
      }
      if (cancelled) return;

      if (active) {
        upStrikesRef.current += 1;
        if (upStrikesRef.current >= CONFIRM_STRIKES) setTunnelActive(true);
      } else {
        upStrikesRef.current = 0;
        setTunnelActive(false);
      }
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [connectionId]);

  return tunnelActive;
}
