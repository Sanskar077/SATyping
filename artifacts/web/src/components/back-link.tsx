/**
 * BackLink — the "← Back" escape hatch on auth pages (login, registration).
 *
 * These pages render outside AppLayout, so without this there is no way back to the landing
 * page except the browser chrome. Fixed to the top-left corner, above the centered card.
 */
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

interface Props {
  /** Where the arrow leads. Defaults to the landing page. */
  href?: string;
  label?: string;
}

export function BackLink({ href = "/", label = "Back to home" }: Props) {
  return (
    <Link
      href={href}
      className="absolute top-5 left-5 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
