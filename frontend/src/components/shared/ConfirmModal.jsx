/**
 * ConfirmModal — confirmation dialog for destructive actions.
 *
 * Follows the design rule: "confirm before destructive actions —
 * always ask 'Are you sure?'"
 *
 * @param {Object} props
 * @param {boolean} props.isOpen           - Whether the modal is visible.
 * @param {string} props.title             - Modal heading (e.g. "Terminate Session?").
 * @param {string} props.message           - Explanation of what will happen.
 * @param {string} [props.confirmText="Confirm"]  - Label for the confirm button.
 * @param {string} [props.cancelText="Cancel"]     - Label for the cancel button.
 * @param {string} [props.variant="danger"]        - "danger" or "primary".
 * @param {Function} props.onConfirm      - Called when the user confirms.
 * @param {Function} props.onCancel       - Called when the user cancels.
 * @returns {JSX.Element|null} The modal component or null when closed.
 */

/** Button color classes for confirm button based on variant. */
const VARIANT_CLASSES = {
  danger: "bg-danger hover:bg-danger-hover",
  primary: "bg-electric-blue hover:bg-electric-blue-hover",
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-navy-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4 border border-navy-700">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        <p className="text-[var(--text-secondary)] mt-2 text-sm">{message}</p>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] border border-navy-600 rounded-lg hover:bg-navy-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-[var(--text-primary)] rounded-lg transition-colors ${VARIANT_CLASSES[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
