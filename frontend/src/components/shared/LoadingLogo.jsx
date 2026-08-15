import OspaceLogo from './OspaceLogo';

/**
 * Branded animated loading state — replaces the plain spinner + text
 * previously used across the provisioning/connecting screens. Purely
 * presentational: callers still own when/whether it's shown and what
 * statusText to pass (real backend progress messages, e.g. vm.notes).
 */
export default function LoadingLogo({ statusText }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      height: '100%',
    }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Soft glow ring behind the logo */}
        <div style={{
          position: 'absolute',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-primary-soft) 0%, transparent 70%)',
          animation: 'ospacePulse 2s ease-in-out infinite',
        }} />

        <OspaceLogo size={64} className="ospace-loading-logo" />
      </div>

      {statusText && (
        <p style={{
          fontSize: '13px',
          color: 'var(--text-muted)',
          fontWeight: 500,
          letterSpacing: '0.3px',
          animation: 'ospaceFadeText 0.4s ease-out',
          minHeight: '18px',
        }}>
          {statusText}
        </p>
      )}

      <style>{`
        @keyframes ospacePulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 0.9; transform: scale(1.15); }
        }

        .ospace-loading-logo {
          animation: ospaceBreathe 2s ease-in-out infinite;
        }

        @keyframes ospaceBreathe {
          0%, 100% { opacity: 0.75; transform: scale(0.97); }
          50% { opacity: 1; transform: scale(1.03); }
        }

        @keyframes ospaceFadeText {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
