"use client";

/**
 * Shared Phase 3 operational building blocks.
 *
 * Small, focused pieces reused by the recovery screens: metric cards for the
 * summary strips, horizontal distribution bars instead of heavy charts,
 * filter/toolbars, a destructive-action confirm dialog and the
 * "conversational signal vs verified fact" callout required by the spec.
 */

import { useMemo } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---------- Metric cards ----------

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  href?: string;
}) {
  const toneClass = {
    default: "",
    success: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
    info: "text-blue-700 dark:text-blue-400",
  }[tone];

  const body = (
    <div className="rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", toneClass)}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Summary strip built from label/value pairs; renders nothing when empty. */
export function MetricRow({
  metrics,
  columns = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6",
}: {
  metrics: { label: string; value: React.ReactNode; hint?: string; href?: string }[];
  columns?: string;
}) {
  if (metrics.length === 0) return null;
  return (
    <div className={cn("grid gap-2", columns)}>
      {metrics.map((m) => (
        <MetricCard key={m.label} label={m.label} value={m.value} hint={m.hint} href={m.href} />
      ))}
    </div>
  );
}

// ---------- Distribution bars ----------

export interface DistEntry {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "info" | "warning" | "danger" | "progress";
}

const BAR_TONES: Record<NonNullable<DistEntry["tone"]>, string> = {
  neutral: "bg-slate-400/70",
  success: "bg-emerald-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  progress: "bg-sky-500",
};

/**
 * Horizontal stacked bar + legend. Preferred over chart libraries: exact
 * values are always visible (no hover needed), it is keyboard/screen-reader
 * friendly and it costs almost nothing in bundle size.
 */
export function DistributionBar({
  entries,
  emptyLabel = "No data yet.",
  className,
}: {
  entries: DistEntry[];
  emptyLabel?: string;
  className?: string;
}) {
  const total = entries.reduce((sum, e) => sum + e.value, 0);

  const segments = useMemo(
    () =>
      entries
        .filter((e) => e.value > 0)
        .map((e) => ({
          ...e,
          pct: total > 0 ? Math.round((e.value / total) * 1000) / 10 : 0,
        })),
    [entries, total],
  );

  if (entries.length === 0 || total === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="img"
        aria-label={entries.map((e) => `${e.label}: ${e.value}`).join(", ")}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        {segments.map((s) => (
          <div
            key={s.label}
            className={cn("h-full", BAR_TONES[s.tone ?? "neutral"])}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${s.value} (${s.pct}%)`}
          />
        ))}
      </div>
      <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {entries.map((e) => (
          <li key={e.label} className="flex items-center gap-2 text-xs">
            <span
              className={cn("size-2 shrink-0 rounded-full", BAR_TONES[e.tone ?? "neutral"])}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.label}</span>
            <span className="tabular-nums font-medium">{e.value}</span>
            <span className="w-12 text-right tabular-nums text-muted-foreground">
              {total > 0 ? `${Math.round((e.value / total) * 100)}%` : "0%"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Toolbar / filter bar ----------

export function FilterBar({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
      {children}
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn("h-9 w-52", className)}
    />
  );
}

// ---------- Confirm dialog (destructive / state-changing actions) ----------

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
  loading = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
  /** Optional extra content (e.g. a reschedule form) above the footer. */
  children?: React.ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : ""}
          >
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- Verification-state callout (spec §12/§13/§15/§48) ----------

/**
 * Renders the mandatory distinction between what the AI *heard* and what the
 * backend has *verified*. `verified` is tri-state: undefined hides the callout.
 */
export function VerificationCallout({
  signal,
  verified,
  className,
}: {
  signal: string;
  verified?: boolean | null;
  className?: string;
}) {
  if (verified === undefined) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
        verified
          ? "border-emerald-600/30 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400"
          : "border-amber-600/30 bg-amber-600/5 text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">AI detected: {signal}</span>
        <span className="block">
          Verification: {verified ? "confirmed" : "pending — not treated as a verified fact"}
        </span>
      </p>
    </div>
  );
}

// ---------- Simple two-column key/value detail ----------

export function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-medium break-words", mono && "font-mono text-xs")}>
        {value ?? "—"}
      </p>
    </div>
  );
}
