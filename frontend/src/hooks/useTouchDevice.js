/**
 * useTouchDevice
 *
 * Answers "is this a real touch device" directly, via genuine touch
 * capability signals, rather than guessing from current screen width —
 * a width-only check (see useBreakpoint's isMobile) genuinely stops being
 * true for a phone rotated to landscape (e.g. 812x375), even though it's
 * still clearly a touch phone. Touch capability doesn't change on
 * rotation, so this is stable across orientation changes.
 */
export default function useTouchDevice() {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}
