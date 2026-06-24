/**
 * LoadingSpinner — a reusable animated spinner for loading states.
 *
 * Use this anywhere data is being fetched to prevent blank white pages.
 * Follows the design rule: "always show a spinner while data loads."
 *
 * @param {Object} props
 * @param {string} [props.message="Loading..."] - Text shown below the spinner.
 * @param {string} [props.size="md"]            - Size variant: "sm", "md", "lg".
 * @returns {JSX.Element} The loading spinner component.
 */

/** Tailwind size classes mapped by variant name. */
const SIZE_CLASSES = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-16 w-16",
};

export default function LoadingSpinner({ message = "Loading...", size = "md" }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div
        className={`${SIZE_CLASSES[size]} animate-spin rounded-full border-4 border-navy-700 border-t-electric-blue`}
      />
      {message && (
        <p className="text-slate-400 mt-4 text-sm">{message}</p>
      )}
    </div>
  );
}
