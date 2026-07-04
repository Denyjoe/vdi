/**
 * Toast — notification component for success/error/info feedback.
 *
 * Follows the design rule: "every action must show a toast notification
 * confirming it worked or explaining what failed."
 *
 * Renders a fixed-position notification at the top-right of the viewport.
 * Auto-dismisses after the specified duration.
 *
 * @param {Object} props
 * @param {string} props.message           - The message to display.
 * @param {string} [props.type="success"]  - Variant: "success", "error", "info", "warning".
 * @param {boolean} props.show             - Whether the toast is visible.
 * @param {Function} props.onClose         - Callback to hide the toast.
 * @param {number} [props.duration=3000]   - Auto-dismiss time in milliseconds.
 * @returns {JSX.Element|null} The toast component or null when hidden.
 */

import { useEffect } from "react";

/** Background color classes mapped by toast type. */
const TYPE_STYLES = {
  success: "bg-success",
  error: "bg-danger",
  info: "bg-electric-blue",
  warning: "bg-warning text-navy-900",
};

export default function Toast({
  message,
  type = "success",
  show,
  onClose,
  duration = 3000,
}) {
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in">
      <div
        className={`${TYPE_STYLES[type]} text-[var(--text-primary)] px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px]`}
      >
        <span className="flex-1 text-sm font-medium">{message}</span>
        <button
          onClick={onClose}
          className="text-[var(--text-primary)]/80 hover:text-[var(--text-primary)] transition-colors text-lg leading-none"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
