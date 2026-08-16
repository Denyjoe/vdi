import { useState, useCallback, useRef } from 'react';

/**
 * useConfirm — awaitable replacement for window.confirm(), backed by the
 * in-app ConfirmDialog component instead of the native browser dialog.
 *
 * Usage:
 *   const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
 *   ...
 *   const ok = await confirm('Delete Workspace', 'This will permanently delete...', true);
 *   if (ok) { doDelete(); }
 *   ...
 *   <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
 */
export default function useConfirm() {
  const [state, setState] = useState({
    isOpen: false, title: '', message: '', destructive: false,
  });
  const resolveRef = useRef(null);

  const confirm = useCallback((title, message, destructive = false) => {
    setState({ isOpen: true, title, message, destructive });
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState(s => ({ ...s, isOpen: false }));
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setState(s => ({ ...s, isOpen: false }));
    resolveRef.current?.(false);
  }, []);

  return { confirmState: state, confirm, handleConfirm, handleCancel };
}
