"use client";

/**
 * Shared Phase 4 building blocks for the control plane.
 *
 * Health cards, capacity meters, utilization bars, the live event stream and
 * the job inspector. Everything renders from backend data only — components
 * degrade gracefully when optional fields are absent (spec §79: no fake
 * infrastructure).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelative } from "@/lib/format";
import { formatMs, formatPercent } from "@/lib/phase4-format";
import { needsAttention } from "@/lib/phase4-meta";
import { EventSeverityBadge, HealthBadge } from "@/components/phase4/phase4-badges";
import type {
  ComponentHealth,
  InfraEvent,
  JobDetail,
  LatencyStats,
  RealtimeEvent,
  ResourceMetric,
} from "@/lib/phase4-types";

// ---------- Health grid (system overview + environment detail) ----------

export function HealthGrid({ components }: { components: ComponentHealth[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {components.map((c) => (
        <ComponentHealthCard key={c.key} component={c} />
      ))}
    </div>
  );
}

export function ComponentHealthCard({ component: c }: { component: ComponentHealth }) {
  const body = (
    <div className="flex h-full flex-col gap-1.5 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{c.label}</p>
        <HealthBadge value={c.state} />
      </div>
      <p className="text-xs text-muted-foreground">{c.message ?? "No status message."}</p>
      <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{c.latency_ms !== null && c.latency_ms !== undefined ? formatMs(c.latency_ms) : null}</span>
        <span>{c.last_checked_at ? `Checked ${formatRelative(c.last_checked_at)}` : "Not checked"}</span>
      </div>
      {c.active_incidents > 0 ? (
        <Badge variant="outline" className="w-fit border-transparent bg-amber-600/15 text-amber-700 dark:text-amber-400">
          {c.active_incidents} active incident{c.active_incidents === 1 ? "" : "s"}
        </Badge>
      ) : null}
    </div>
  );
  return c.href ? (
    <Link href={c.href} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

export function HealthGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ---------- Latency stats ----------

/** Renders avg + percentiles only for the values the backend actually sent. */
export function LatencyStat({ stats, className }: { stats: LatencyStats | null | undefined; className?: string }) {
  if (!stats) return <span className="text-xs text-muted-foreground">—</span>;
  const entries: [string, number | null | undefined][] = [
    ["avg", stats.avg_ms],
    ["p50", stats.p50_ms],
    ["p95", stats.p95_ms],
    ["p99", stats.p99_ms],
  ];
  const present = entries.filter(([, v]) => v !== null && v !== undefined);
  if (present.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={cn("text-xs tabular-nums", className)}>
      {present.map(([label, value], i) => (
        <span key={label}>
          {i > 0 ? " · " : ""}
          <span className="text-muted-foreground">{label}</span> {formatMs(value)}
        </span>
      ))}
    </span>
  );
}

// ---------- Capacity meter (spec §36) ----------

const METER_TONES = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-red-500",
} as const;

export function CapacityMeter({
  label,
  value,
  max,
  unit,
}: {
  label: string;
  value: number | null | undefined;
  max: number | null | undefined;
  unit?: string | null;
}) {
  const hasValue = value !== null && value !== undefined && Number.isFinite(value);
  const pct =
    hasValue && max !== null && max !== undefined && Number.isFinite(max) && max > 0
      ? Math.min(100, Math.max(0, (value / max) * 100))
      : null;
  const tone = pct === null ? "ok" : pct >= 90 ? "danger" : pct >= 70 ? "warn" : "ok";

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {hasValue ? value : "—"}
          {max !== null && max !== undefined && Number.isFinite(max) ? ` / ${max}` : ""}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max ?? undefined}
        aria-valuenow={hasValue ? value : undefined}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        {pct !== null ? (
          <div className={cn("h-full rounded-full", METER_TONES[tone])} style={{ width: `${pct}%` }} />
        ) : null}
      </div>
      {pct !== null ? (
        <p className="text-[10px] text-muted-foreground tabular-nums">{formatPercent(pct / 100)} utilized</p>
      ) : null}
    </div>
  );
}

export function ResourceMeterList({ resources }: { resources: ResourceMetric[] }) {
  if (resources.length === 0) {
    return <p className="text-xs text-muted-foreground">Resource metrics are not reported for this worker.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resources.map((r) => (
        <CapacityMeter key={r.key} label={r.label} value={r.value} max={r.max} unit={r.unit} />
      ))}
    </div>
  );
}

// ---------- Event stream (live + persisted share the row shape) ----------

export type StreamRow = InfraEvent | RealtimeEvent;

function rowKey(e: StreamRow): string {
  return e.id;
}

function rowAt(e: StreamRow): string {
  return e.at;
}

export function EventStreamView({
  events,
  emptyLabel = "No events yet.",
  maxRows,
}: {
  events: StreamRow[];
  emptyLabel?: string;
  maxRows?: number;
}) {
  const rows = maxRows ? events.slice(0, maxRows) : events;
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">{emptyLabel}</p>
    );
  }
  return (
    <ul className="divide-y rounded-lg border" aria-live="polite">
      {rows.map((e) => (
        <li key={rowKey(e)} className="flex items-start gap-3 px-3 py-2">
          <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">
            {new Date(rowAt(e)).toLocaleTimeString("en-GB", { hour12: false })}
          </span>
          <EventSeverityBadge value={e.severity} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{e.message ?? e.event_type}</p>
            <p className="text-[10px] text-muted-foreground">
              {e.category}
              {"service" in e && e.service ? ` · ${e.service}` : ""}
              {` · ${e.event_type}`}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Simple utilization bar (usage page) ----------

export function UtilizationBar({
  label,
  used,
  limit,
  hint,
}: {
  label: string;
  used: number | null;
  limit: number | null;
  hint?: string | null;
}) {
  const pct =
    used !== null && used !== undefined && limit !== null && limit !== undefined && limit > 0
      ? Math.min(100, (used / limit) * 100)
      : null;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {used ?? "—"} / {limit ?? "—"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {pct !== null ? (
          <div
            className={cn("h-full rounded-full", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500")}
            style={{ width: `${pct}%` }}
          />
        ) : null}
      </div>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ---------- Heartbeat strip (worker detail) ----------

export function HeartbeatStrip({ history }: { history: { at: string; ok: boolean }[] }) {
  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">No heartbeat history reported.</p>;
  }
  return (
    <div className="flex items-end gap-0.5" role="img" aria-label={`Last ${history.length} heartbeats`}>
      {history.map((h) => (
        <span
          key={h.at}
          title={`${formatDateTime(h.at)}: ${h.ok ? "alive" : "missed"}`}
          className={cn("h-4 w-1.5 rounded-sm", h.ok ? "bg-emerald-500/80" : "bg-red-500")}
        />
      ))}
    </div>
  );
}

// ---------- Dependency graph (service detail, spec §6) ----------

export interface DependencyNode {
  id: string;
  label: string;
  state?: string | null;
  href?: string | null;
}

export function DependencyGraph({
  center,
  dependencies,
  dependents,
}: {
  center: DependencyNode;
  dependencies: DependencyNode[];
  dependents: DependencyNode[];
}) {
  if (dependencies.length === 0 && dependents.length === 0) {
    return <p className="text-xs text-muted-foreground">No dependency relationships reported for this service.</p>;
  }

  const Node = ({ node }: { node: DependencyNode }) => {
    const content = (
      <span
        className={cn(
          "inline-flex max-w-44 items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs font-medium",
          needsAttention(node.state) && "border-amber-600/40",
        )}
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            node.state ? (needsAttention(node.state) ? "bg-amber-500" : "bg-emerald-500") : "bg-muted-foreground/40",
          )}
          aria-hidden
        />
        <span className="truncate">{node.label}</span>
      </span>
    );
    return node.href ? <Link href={node.href}>{content}</Link> : content;
  };

  return (
    <div className="space-y-4 overflow-x-auto">
      {dependents.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Depended on by</p>
          <div className="flex flex-wrap gap-1.5">
            {dependents.map((d) => (
              <Node key={d.id} node={d} />
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border-2 border-primary bg-primary/5 px-2.5 py-1 text-xs font-semibold",
          )}
        >
          {center.label}
        </span>
      </div>
      {dependencies.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Depends on</p>
          <div className="flex flex-wrap gap-1.5">
            {dependencies.map((d) => (
              <Node key={d.id} node={d} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- Routing pipeline (AI routing page) ----------

export interface PipelineStep {
  position: number;
  role: string;
  label: string;
  state: string | null;
  triggers: string[];
}

export function RoutingPipeline({ steps }: { steps: PipelineStep[] }) {
  if (steps.length === 0) {
    return <p className="text-xs text-muted-foreground">No routing chain reported by the backend.</p>;
  }
  return (
    <ol className="space-y-1">
      {steps.map((s, i) => (
        <li key={s.position} className="space-y-1">
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2",
              s.role === "PRIMARY" ? "border-primary/40 bg-primary/5" : "bg-card",
              needsAttention(s.state) && "border-amber-600/40",
            )}
          >
            <span className="font-mono text-[10px] text-muted-foreground">#{s.position}</span>
            <span className="text-sm font-medium">{s.label}</span>
            <HealthBadge value={s.state ?? "UNKNOWN"} />
            <span className="ml-auto text-[10px] text-muted-foreground">{s.role.toLowerCase()}</span>
          </div>
          {s.triggers.length > 0 ? (
            <p className="pl-3 text-[10px] text-muted-foreground">
              falls through on: {s.triggers.join(", ").toLowerCase().replace(/_/g, " ")}
            </p>
          ) : null}
          {i < steps.length - 1 ? (
            <ChevronDown className="ml-6 size-3.5 text-muted-foreground" aria-hidden />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

// ---------- Job inspector (spec §49) ----------

function InspectorField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn("text-sm font-medium break-words", mono && "font-mono text-xs")}>{value ?? "—"}</p>
    </div>
  );
}

export function JobInspector({ job, children }: { job: JobDetail; children?: React.ReactNode }) {
  const [showTechnical, setShowTechnical] = useState(false);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <InspectorField label="Job ID" value={<span className="font-mono">{job.id}</span>} />
        <InspectorField label="Type" value={job.job_type} />
        <InspectorField label="Queue" value={job.queue} />
        <InspectorField label="Status" value={job.status} />
        <InspectorField
          label="Attempts"
          value={job.attempts ?? "—"}
          mono
        />
        <InspectorField label="Worker" value={job.worker_name ?? job.worker_id} />
        <InspectorField label="Created" value={formatDateTime(job.created_at)} />
        <InspectorField label="Started" value={formatDateTime(job.started_at)} />
        <InspectorField label="Completed" value={formatDateTime(job.completed_at)} />
      </div>

      {job.related ? (
        <div className="rounded-md border px-3 py-2">
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Related entity</p>
          {job.related.href ? (
            <Link href={job.related.href} className="text-sm font-medium underline-offset-4 hover:underline">
              {job.related.label ?? `${job.related.kind} ${job.related.id}`}
            </Link>
          ) : (
            <p className="text-sm font-medium">{job.related.label ?? `${job.related.kind} ${job.related.id}`}</p>
          )}
        </div>
      ) : null}

      {job.error_message ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-[10px] tracking-wide text-destructive uppercase">Error</p>
          <p className="text-sm font-medium text-destructive">{job.error_code ?? "ERROR"}</p>
          <p className="text-xs text-muted-foreground">{job.error_message}</p>
        </div>
      ) : null}

      {job.retry_history.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold">Retry history</p>
          <ul className="space-y-1">
            {job.retry_history.map((r) => (
              <li key={r.attempt} className="flex items-center gap-2 text-xs">
                <Badge variant={r.ok ? "outline" : "destructive"} className="h-4 px-1.5 text-[10px]">
                  #{r.attempt}
                </Badge>
                <span className="text-muted-foreground">{formatDateTime(r.at)}</span>
                {!r.ok && r.error_code ? <span className="font-medium">{r.error_code}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {job.technical_details ? (
        <div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowTechnical((v) => !v)}>
            <ChevronDown className={cn("size-3.5 transition-transform", showTechnical && "rotate-180")} />
            Technical details
          </Button>
          {showTechnical ? (
            <pre className="mt-1 overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] whitespace-pre-wrap">
              {job.technical_details}
            </pre>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}

// ---------- Section card helper ----------

export function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-0.5">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ---------- Inline refresh indicator ----------

export function UpdatedAt({ at }: { at: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <RefreshCw className="size-3" aria-hidden />
      Updated {at ? formatRelative(at) : "never"}
    </span>
  );
}

/** Stacked distribution of counts by label — used for queue/job summaries. */
export function StackedCounts({
  entries,
}: {
  entries: { label: string; value: number | null; tone?: "neutral" | "success" | "warning" | "danger" | "info" }[];
}) {
  const total = useMemo(() => entries.reduce((sum, e) => sum + (e.value ?? 0), 0), [entries]);
  const filled = entries.filter((e) => (e.value ?? 0) > 0);
  if (total === 0) return <p className="text-xs text-muted-foreground">No jobs recorded.</p>;
  const toneClass: Record<string, string> = {
    neutral: "bg-slate-400/70",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-blue-500",
  };
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={entries.map((e) => `${e.label}: ${e.value ?? 0}`).join(", ")}>
        {filled.map((e) => (
          <div
            key={e.label}
            className={cn("h-full", toneClass[e.tone ?? "neutral"])}
            style={{ width: `${((e.value ?? 0) / total) * 100}%` }}
            title={`${e.label}: ${e.value}`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map((e) => (
          <li key={e.label} className="flex items-center gap-1.5 text-[11px]">
            <span className={cn("size-1.5 rounded-full", toneClass[e.tone ?? "neutral"])} aria-hidden />
            <span className="text-muted-foreground">{e.label}</span>
            <span className="tabular-nums font-medium">{e.value ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Degraded banner ----------

export function DegradedBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-600/30 bg-amber-600/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
