/**
 * ConfirmModal — confirmation dialog for destructive actions.
 *
 * Follows the design rule: "confirm before destructive actions —
 * always ask 'Are you sure?'"
 *
 * Uses CSS custom-property tokens so the modal adapts to both
 * light and dark themes without any hardcoded color values.
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
import { useEffect, useRef } from "react";
import { AlertTriangle, Info } from "lucide-react";

/** Per-variant styling tokens (all use CSS variables for theme compat). */
const VARIANT_CONFIG = {
  danger: {
    accentBar: "var(--status-error)",
    iconBg: "var(--status-error-bg)",
    iconColor: "var(--status-error)",
    confirmBg: "var(--status-error)",
    confirmHoverBg: "#DC2626",
    Icon: AlertTriangle,
  },
  primary: {
    accentBar: "var(--accent-primary)",
    iconBg: "var(--accent-primary-soft)",
    iconColor: "var(--accent-primary)",
    confirmBg: "var(--accent-primary)",
    confirmHoverBg: "var(--accent-primary-hover)",
    Icon: Info,
  },
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
  const dialogRef = useRef(null);
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.danger;
  const { Icon } = config;

  /* Close on Escape key */
  useEffect(() => {
    if (!isOpen) return;

    /**
     * Handle keyboard shortcuts while the modal is open.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    const handleKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  /* Auto-focus the cancel button for safety */
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* ── Backdrop ───────────────────────────────────────────── */}
      <div
        className="absolute inset-0 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.55)" }}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* ── Dialog ─────────────────────────────────────────────── */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl overflow-hidden animate-[scaleIn_200ms_ease-out]"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {/* ── Top accent bar ──────────────────────────────────── */}
        <div
          className="h-1"
          style={{ backgroundColor: config.accentBar }}
        />

        {/* ── Content ─────────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-2">
          {/* Icon + Title row */}
          <div className="flex items-start gap-4">
            {/* Animated icon circle */}
            <div
              className="shrink-0 flex items-center justify-center w-11 h-11 rounded-full"
              style={{ backgroundColor: config.iconBg }}
            >
              <Icon
                className="w-5 h-5"
                style={{ color: config.iconColor }}
                strokeWidth={2.2}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2
                id="confirm-modal-title"
                className="text-base font-semibold leading-snug"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </h2>
              <p
                id="confirm-modal-desc"
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div
          className="mx-6 mt-4"
          style={{
            height: "1px",
            backgroundColor: "var(--border-color)",
          }}
        />

        {/* ── Actions ─────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 px-6 py-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer"
            style={{
              color: "var(--text-primary)",
              backgroundColor: "transparent",
              border: "1px solid var(--border-strong)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold rounded-lg text-white cursor-pointer"
            style={{
              backgroundColor: config.confirmBg,
              border: "1px solid transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = config.confirmHoverBg;
              e.currentTarget.style.boxShadow = `0 0 12px ${config.confirmBg}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = config.confirmBg;
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      {/* ── Keyframe animations (injected once via <style>) ──── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
