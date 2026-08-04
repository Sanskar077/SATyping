/**
 * AmbientBackdrop — animated sandstone strata behind the liquid-glass UI.
 *
 * Hand-built SVG (Hallmark Tier B), modelled on a macro photograph of layered
 * sandstone: slow horizontal bands of warm sediment drifting past each other.
 * Colours come from theme tokens (see .stratum-* in index.css), so the SAME
 * component renders deep terracotta in dark mode and pale sun-washed sand in
 * light mode — the "light theme image" is generated, not shipped.
 *
 * Performance contract:
 *  - transform-only animation (translateX), compositor thread, no JS after mount
 *  - three layers, 90–220s periods → imperceptible CPU, no paint storms
 *  - each SVG is 200% wide with a wave period that divides the 50% travel
 *    distance, so the loop is seamless
 *  - honours prefers-reduced-motion (drift stops) and
 *    prefers-reduced-transparency (whole backdrop hidden) via index.css
 */

/** One seamless wave band: 4 × 720px periods across a 2880-wide viewBox. */
function stratumPath(y: number, amp: number): string {
  let d = `M0 ${y}`;
  for (let x = 0; x < 2880; x += 720) {
    d += ` C ${x + 180} ${y - amp}, ${x + 360} ${y + amp}, ${x + 720} ${y}`;
  }
  return d + " L2880 900 L0 900 Z";
}

/**
 * Six bands at staggered depths and speeds. The reference photo's character comes from
 * MANY thin strata at slightly different angles, not a few thick ones — so bands are
 * spaced ~110px apart with alternating drift directions, which reads as parallax depth.
 */
const LAYERS = [
  { y: 120, amp: 30, className: "stratum-1", duration: "240s", reverse: false },
  { y: 250, amp: 44, className: "stratum-2", duration: "185s", reverse: true },
  { y: 380, amp: 34, className: "stratum-3", duration: "215s", reverse: false },
  { y: 510, amp: 52, className: "stratum-4", duration: "150s", reverse: true },
  { y: 650, amp: 38, className: "stratum-5", duration: "195s", reverse: false },
  { y: 780, amp: 28, className: "stratum-6", duration: "130s", reverse: true },
] as const;

export function AmbientBackdrop() {
  return (
    <div className="ambient-backdrop" aria-hidden>
      {LAYERS.map(({ y, amp, className, duration, reverse }) => (
        <svg
          key={className}
          className="stratum-layer"
          style={{
            animationDuration: duration,
            animationDirection: reverse ? "reverse" : "normal",
          }}
          viewBox="0 0 2880 900"
          preserveAspectRatio="none"
        >
          <path className={className} d={stratumPath(y, amp)} />
        </svg>
      ))}
    </div>
  );
}
