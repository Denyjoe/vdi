import { useEffect, useState } from 'react';
import useThemeStore from '../../store/themeStore';

/**
 * VM power-on loading animation recreating the Ospace mark's own real
 * geometry, measured directly from the source PNGs (pixel/flood-fill
 * analysis of ospace-logo-black.png / ospace-logo-white.png), not
 * guessed:
 *   - large circle outer diameter = 300px, stroke width = 18px  (≈6% of
 *     diameter)
 *   - small circle outer diameter = 135px                       (0.45 of
 *     the large circle's diameter)
 *   - center-to-center distance ≈83px; 83 + small_outer_radius(67.5)
 *     ≈150.5 ≈ large_outer_radius(150) — the small circle is fully
 *     contained inside the large one and internally tangent to its outer
 *     edge at a single point in the static mark.
 * For the animated version the small circle orbits along the INSIDE edge
 * of the large ring's track (tangent to the ring's inner edge rather than
 * its outer edge), which keeps it strictly, provably contained — its
 * outer edge never reaches the large circle's own outer boundary at any
 * angle — while still using the mark's real 0.45 size ratio.
 *
 * Ink colors are the mark's own real sampled colors (not the generic
 * --accent-primary token), switched via the same real theme store
 * OspaceLogo uses: white mark (#F3F2ED) on dark theme, black mark
 * (#12121A) on light theme.
 */
const SMALL_CIRCLE_RATIO = 0.45; // small outer diameter / large outer diameter, measured
const STROKE_RATIO = 0.06; // stroke width / large outer diameter, measured (18/300)

const INK_COLORS = {
  dark: '#F3F2ED', // sampled from ospace-logo-white.png
  light: '#12121A', // sampled from ospace-logo-black.png
};

export default function PowerOnAnimation({ size = 80, statusText }) {
  const theme = useThemeStore(s => s.theme);
  const ink = theme === 'dark' ? INK_COLORS.dark : INK_COLORS.light;

  const [angle, setAngle] = useState(0);

  useEffect(() => {
    let frame;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      setAngle(((elapsed / 1400) * 360) % 360);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const largeRadius = size / 2;
  const strokeWidth = size * STROKE_RATIO;
  const smallCircleSize = size * SMALL_CIRCLE_RATIO;
  const smallRadius = smallCircleSize / 2;
  // Orbit the small circle's center so its outer edge stays tangent to
  // the INSIDE of the large ring's stroke — mathematically guaranteed to
  // never cross the large circle's own outer boundary at any angle.
  const orbitRadius = largeRadius - strokeWidth - smallRadius;

  const rad = (angle * Math.PI) / 180;
  const smallX = largeRadius + orbitRadius * Math.cos(rad);
  const smallY = largeRadius + orbitRadius * Math.sin(rad);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
    }}>
      <div style={{
        position: 'relative',
        width: size,
        height: size,
      }}>
        {/* Large circle — fixed, matching the mark's real outer
            diameter/stroke-weight ratio and real ink color */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `${strokeWidth}px solid ${ink}`,
          opacity: 0.9,
        }} />

        {/* Small circle — orbits via real per-frame sin/cos position,
            sized at the mark's real 0.45 ratio, radius chosen so it is
            provably contained inside the large circle at every angle */}
        <div style={{
          position: 'absolute',
          width: smallCircleSize,
          height: smallCircleSize,
          borderRadius: '50%',
          background: ink,
          left: smallX - smallRadius,
          top: smallY - smallRadius,
          boxShadow: `0 0 6px ${ink}`,
        }} />
      </div>

      {statusText && (
        <p style={{
          fontSize: '13px',
          color: 'var(--text-muted)',
          fontWeight: 500,
          letterSpacing: '0.3px',
          textAlign: 'center',
        }}>
          {statusText}
        </p>
      )}
    </div>
  );
}
