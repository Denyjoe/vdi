/**
 * Two-circle orbital "powering on" animation, used specifically for the
 * VM boot/provisioning stage — distinct from LoadingLogo, which owns the
 * later "connecting to the desktop stream" stage once the VM is running.
 * A large ring rotates steadily while a small dot orbits its edge at a
 * different speed, giving an elegant, non-arbitrary sense of two things
 * spinning up independently (VM boot vs. network/service handshake).
 */
export default function PowerOnAnimation({ size = 80, statusText }) {
  const ringSize = size;
  const dotSize = size * 0.16;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
    }}>
      <div style={{
        position: 'relative',
        width: `${ringSize}px`,
        height: `${ringSize}px`,
      }}>
        {/* Large outer ring — slow, steady rotation */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent-primary)',
          animation: 'ospaceRingSpin 3s linear infinite',
        }} />

        {/* Small orbiting dot — faster, layered motion */}
        <div style={{
          position: 'absolute',
          inset: 0,
          animation: 'ospaceOrbit 1.4s linear infinite',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            marginLeft: `-${dotSize / 2}px`,
            marginTop: `-${dotSize / 2}px`,
            borderRadius: '50%',
            background: 'var(--accent-primary)',
            boxShadow: '0 0 8px var(--accent-primary)',
          }} />
        </div>

        {/* Center pulse dot for depth */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${size * 0.12}px`,
          height: `${size * 0.12}px`,
          marginLeft: `-${size * 0.06}px`,
          marginTop: `-${size * 0.06}px`,
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          opacity: 0.6,
          animation: 'ospaceCenterPulse 2s ease-in-out infinite',
        }} />
      </div>

      {statusText && (
        <p style={{
          fontSize: '13px',
          color: 'var(--text-muted)',
          fontWeight: 500,
          letterSpacing: '0.3px',
          textAlign: 'center',
        }}>
          {statusText}
        </p>
      )}

      <style>{`
        @keyframes ospaceRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes ospaceOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes ospaceCenterPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
