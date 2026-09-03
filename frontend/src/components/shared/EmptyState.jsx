import { Inbox } from "lucide-react";

/**
 * EmptyState — shown when a list or section has no data.
 *
 * Follows the design rule: "always show a helpful message when a list
 * is empty — never just a blank section."
 *
 * @param {Object} props
 * @param {JSX.Element} [props.icon]      - Icon element displayed above the message.
 * @param {string} props.title           - Short headline (e.g. "No VMs Found").
 * @param {string} [props.description]   - Optional longer explanation.
 * @param {JSX.Element} [props.action]   - Optional CTA button or link.
 * @returns {JSX.Element} The empty state component.
 */
export default function EmptyState({
  icon = <Inbox className="w-12 h-12 text-muted mx-auto" />,
  title,
  description,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      {description && (
        <p className="text-[var(--text-secondary)] mt-2 text-sm text-center max-w-md">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
