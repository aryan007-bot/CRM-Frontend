/**
 * Display formatters.
 *
 * Money arrives from the backend as exact decimal strings (e.g. "45000.00").
 * It is formatted by manipulating those digits as text rather than routing them
 * through `Number`, so large or precise values can never drift.
 */

function splitDecimal(value: string): { sign: string; whole: string; fraction: string } | null {
  const match = /^\s*([+-]?)(\d*)(?:\.(\d*))?\s*$/.exec(value);
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  if (!whole && !fraction) return null;
  return { sign, whole: whole || "0", fraction };
}

function groupWestern(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/**
 * Formats a decimal money string exactly, to two fraction digits.
 * `formatMoney("45000.00")` -> "₹45,000.00"
 */
export function formatMoney(
  value: string | number | null | undefined,
  currency = "INR",
): string {
  if (value === null || value === undefined || value === "") return "—";

  const raw = typeof value === "string" ? value : String(value);
  const parts = splitDecimal(raw);
  if (!parts) return raw;

  const fraction = `${parts.fraction}00`.slice(0, 2);
  const digits = parts.whole.replace(/^0+(?=\d)/, "");
  const grouped = currency === "INR" ? groupIndian(digits) : groupWestern(digits);
  const symbol = CURRENCY_SYMBOLS[currency];

  if (symbol) {
    return `${parts.sign === "-" ? "-" : ""}${symbol}${grouped}.${fraction}`;
  }
  return `${parts.sign}${currency} ${grouped}.${fraction}`;
}

/**
 * Adds decimal money strings exactly, using integer cents (BigInt).
 * Use this instead of `reduce((a, b) => a + Number(b))` so sums never drift.
 * Returns a plain decimal string such as "12500.75".
 */
export function sumMoney(values: Array<string | null | undefined>): string {
  let totalCents = BigInt(0);

  for (const value of values) {
    if (value === null || value === undefined) continue;
    const parts = splitDecimal(String(value));
    if (!parts) continue;

    const sign = parts.sign === "-" ? BigInt(-1) : BigInt(1);
    const whole = BigInt(parts.whole);
    const cents = BigInt(`${parts.fraction}00`.slice(0, 2));
    totalCents += sign * (whole * BigInt(100) + cents);
  }

  const negative = totalCents < BigInt(0);
  const absolute = negative ? -totalCents : totalCents;
  const whole = absolute / BigInt(100);
  const cents = (absolute % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${cents}`;
}

/** Formats a count with thousands separators. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
}

/** Formats a `YYYY-MM-DD` date string. Timezone-free: the value is a plain date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const future = diffMs < 0;
  const mins = Math.round(Math.abs(diffMs) / 60_000);
  const suffix = future ? "from now" : "ago";

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ${suffix}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  return formatDate(value.slice(0, 10));
}

/** "partially_completed" -> "Partially completed" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Maps a snake_case API enum value to a CSS-friendly token. */
export function statusToken(value: string | null | undefined): string {
  return (value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// ---------- Phase 2: call timing ----------

/**
 * Elapsed seconds since `startedAtIso`, computed on demand.
 * The caller decides when to re-render; this function never holds state, so a
 * call timer is always derived from the backend timestamp, never incremented
 * from frontend state.
 */
export function elapsedSeconds(startedAtIso: string | null | undefined): number {
  if (!startedAtIso) return 0;
  const started = Date.parse(startedAtIso);
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

/** 161 -> "02:41"; 3725 -> "1:02:05". Negative or invalid input renders as "—". */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) {
    return "—";
  }
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Convenience for live rows: duration label from a backend start timestamp. */
export function formatCallDuration(startedAtIso: string | null | undefined): string {
  return formatDuration(elapsedSeconds(startedAtIso));
}
