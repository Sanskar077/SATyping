import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * App-wide theme provider (next-themes). Toggles the `.dark` class on <html>,
 * which drives the light/dark token sets in index.css. Client-only SPA, so no
 * hydration concerns — but we disable transition flashes on switch.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="satyping-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
