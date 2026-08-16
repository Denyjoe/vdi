import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmDialog — single, reusable in-app confirmation modal, replacing
 * native window.confirm()/alert() dialogs across the app. Pair with the
 * useConfirm() hook for a minimally-different drop-in replacement of
 * scattered `if (window.confirm(...))` call sites.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
    }} onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '24px',
        width: '360px',
        maxWidth: '90vw',
        boxShadow: 'var(--shadow-xl)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '16px',
        }}>
          {destructive && (
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--status-error-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <AlertTriangle size={18} style={{ color: 'var(--status-error)' }} />
            </div>
          )}
          <div>
            <h3 style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '4px',
            }}>{title}</h3>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}>{message}</p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
        }}>
          <button onClick={onCancel}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              background: 'var(--bg-input)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              background: destructive ? 'var(--status-error)' : 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
