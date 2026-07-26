/**
 * SATyping brand — pure wordmark (concept E).
 *
 * The brand IS the type: "SA" in foreground, "Typing" in primary coral, closed by a blinking
 * text caret — the product's whole subject in one glyph of motion. No icon mark by design;
 * square-format contexts (favicon, avatars) use the minimal S tile in public/favicon.svg.
 *
 * The caret blink is a steps() cut (a real terminal caret, not a fade) and is disabled under
 * prefers-reduced-motion via the .brand-caret rule in index.css.
 */
import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  /** Hide the blinking caret (e.g. when many wordmarks render at once). */
  caret?: boolean;
}

export function BrandWordmark({ className = "", caret = true }: WordmarkProps) {
  return (
    <span
      className={cn("inline-flex items-baseline font-bold tracking-tight select-none", className)}
      aria-label="SATyping"
    >
      SA<span className="text-primary">Typing</span>
      {caret && <span aria-hidden className="brand-caret" />}
    </span>
  );
}

/**
 * Back-compat shim: earlier layouts rendered an icon + wordmark pair. With the type-only brand
 * there is no icon, so this renders nothing — call sites can drop it at leisure.
 */
export function BrandLogo(_props: { className?: string }) {
  return null;
}
