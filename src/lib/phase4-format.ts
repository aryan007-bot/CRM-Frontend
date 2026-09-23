/**
 * Phase 4 display formatters — thin additions over `lib/format.ts` for the
 * operational metrics the control plane renders. All pure and unit-tested.
 */

import { formatCount } from "./format";

/** 42 -> "42 ms"; null -> "—". */
export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatCount(Math.round(value))} ms`;
}

/** 0.995 -> "99.5%"; null -> "—". Pass `fraction=false` for already-percent values. */
export function formatPercent(
  value: number | null | undefined,
  fraction = true,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const pct = fraction ? value * 100 : value;
  return `${Math.round(pct * 10) / 10}%`;
}

/** Formats a byte count as KB/MB/GB; null -> "—". */
export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let scaled = value;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${Math.round(scaled * 10) / 10} ${units[unit]}`;
}

/** Utilization percent from used/limit; null-safe. Returns null when unknown. */
export function utilizationPercent(
  used: number | null | undefined,
  limit: number | null | undefined,
): number | null {
  if (
    used === null || used === undefined || !Number.isFinite(used) ||
    limit === null || limit === undefined || !Number.isFinite(limit) || limit <= 0
  ) {
    return null;
  }
  return Math.max(0, Math.min(100, (used / limit) * 100));
}

/** Renders a configuration value safely — never a secret. */
export function configValueLabel(
  item: { value: string | number | boolean | null; is_secret: boolean; state: string },
): string {
  if (item.is_secret) {
    return item.state === "CONFIGURED" ? "Configured ✓" : "Not configured";
  }
  if (item.value === null || item.value === "") return "—";
  return String(item.value);
}

/** Derives the environment label from an explicit value or the build env. */
export function environmentLabel(explicit?: string | null): string {
  if (explicit) return explicit;
  if (process.env.NEXT_PUBLIC_CONTROL_PLANE_ENV) {
    return process.env.NEXT_PUBLIC_CONTROL_PLANE_ENV;
  }
  return process.env.NODE_ENV === "production" ? "Production" : "Development";
}

/** True for the production environment — drives the persistent badge + confirms. */
export function isProductionEnvironment(explicit?: string | null): boolean {
  return environmentLabel(explicit).toLowerCase() === "production";
}
