import useThemeStore from '../../store/themeStore';
import logoWhite from '../../assets/ospace-logo-white.png';
import logoBlack from '../../assets/ospace-logo-black.png';

/**
 * Theme-aware Ospace wordmark/icon. Uses the app's real theme store
 * (useThemeStore, persisted under 'clouddesk-theme' in localStorage and
 * mirrored to <html data-theme>) — not a separate theme mechanism.
 * White mark on dark theme, black mark on light theme.
 */
export default function OspaceLogo({ size = 32, className = '' }) {
  const theme = useThemeStore(s => s.theme);
  const src = theme === 'dark' ? logoWhite : logoBlack;

  return (
    <img
      src={src}
      alt="Ospace"
      style={{ height: size, width: 'auto' }}
      className={className}
    />
  );
}
