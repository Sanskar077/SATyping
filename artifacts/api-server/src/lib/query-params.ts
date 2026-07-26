/**
 * Query-string boolean parsing.
 *
 * Booleans arrive in a query string as the literal strings "true"/"false" (also "1"/"0"). The
 * generated Zod query schemas expect a real boolean, and Zod's z.coerce.boolean() cannot be used
 * because it is just Boolean(value) — so "false" would coerce to TRUE, silently inverting every
 * ?flag=false filter. Routes therefore normalise boolean query params through this helper BEFORE
 * running the generated schema's safeParse.
 */

/** Converts a single query value to a boolean, or undefined if absent/unrecognised. */
export function parseBoolQueryParam(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
}

/**
 * Returns a shallow copy of `query` with the named keys converted from string to boolean (keys
 * that are absent or unrecognised are dropped, so an optional flag stays optional). Everything else
 * is passed through untouched for the generated schema to validate.
 */
export function normalizeBoolQueryParams<T extends Record<string, unknown>>(
  query: T,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...query };
  for (const key of keys) {
    if (!(key in out)) continue;
    const parsed = parseBoolQueryParam(out[key]);
    if (parsed === undefined) delete out[key];
    else out[key] = parsed;
  }
  return out;
}
