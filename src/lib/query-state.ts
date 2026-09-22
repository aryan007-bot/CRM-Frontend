/**
 * URL query-state helpers (spec §36).
 *
 * List screens keep filters in the URL so views are bookmarkable, refresh-safe
 * and shareable between operators. Serialisation stays string-based and
 * round-trips through `URLSearchParams`.
 */

export type QueryValue = string | number | boolean | null | undefined;

/** Converts a filter object into a record for `router.replace/params`. */
export function toSearchParams(
  values: Record<string, QueryValue>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = String(value);
  }
  return out;
}

/** Reads a string filter from URLSearchParams with a default. */
export function getString(
  params: URLSearchParams,
  key: string,
  fallback = "",
): string {
  const value = params.get(key);
  return value === null || value === "" ? fallback : value;
}

/** Reads a positive integer (page numbers etc.). */
export function getPositiveInt(
  params: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const parsed = Number.parseInt(params.get(key) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Reads an optional numeric filter; blank means "unset". */
export function getOptionalNumber(
  params: URLSearchParams,
  key: string,
): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw === "") return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Builds a URL query string from filter values, dropping empties. */
export function buildQueryString(
  values: Record<string, QueryValue>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
