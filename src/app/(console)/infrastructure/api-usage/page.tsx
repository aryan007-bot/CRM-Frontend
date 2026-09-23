"use client";

/**
 * API Usage (spec §51 + §52).
 *
 * Request volume, error split, latency and rate limiting — all from backend
 * metrics — plus per-endpoint-group health.
 */

import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { LatencyStat, SectionCard, UpdatedAt } from "@/components/phase4/phase4-parts";
import { HealthBadge } from "@/components/phase4/phase4-badges";
import { StackedCounts } from "@/components/phase4/phase4-parts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { apiUsageApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatCount } from "@/lib/format";
import { formatPercent } from "@/lib/phase4-format";

export default function ApiUsagePage() {
  const usage = useApi(() => apiUsageApi.usage(), []);
  const health = useApi(() => apiUsageApi.health(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:system")) {
      usage.refresh();
      health.refresh();
    }
  };
  useLiveCallSocket({ onEvent });

  const data = usage.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="API Usage"
        description="Request volume, errors and latency for the platform API. All values come from backend metrics."
        actions={<UpdatedAt at={data?.updated_at} />}
      />

      {usage.error ? (
        <ErrorState message={usage.error} onRetry={usage.refresh} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="Requests" value={formatCount(data.requests)} />
            <SummaryTile label="2xx" value={formatCount(data.ok_2xx)} tone="success" />
            <SummaryTile label="4xx" value={formatCount(data.errors_4xx)} tone="warning" />
            <SummaryTile label="5xx" value={formatCount(data.errors_5xx)} tone="danger" />
          </div>

          <SectionCard title="Response mix">
            <StackedCounts
              entries={[
                { label: "2xx", value: data.ok_2xx, tone: "success" },
                { label: "4xx", value: data.errors_4xx, tone: "warning" },
                { label: "5xx", value: data.errors_5xx, tone: "danger" },
              ]}
            />
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span>Latency: <LatencyStat stats={data.latency} /></span>
              <span>Rate limited: {formatCount(data.rate_limited)}</span>
            </div>
          </SectionCard>

          <SectionCard title="Top endpoints" description="Highest-traffic endpoints in the current window.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">P95</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.top_endpoints ?? []).map((e) => (
                  <TableRow key={e.endpoint}>
                    <TableCell className="font-mono text-xs">{e.endpoint}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(e.requests)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(e.errors)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.p95_ms !== null ? `${formatCount(e.p95_ms)} ms` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title="Requests by service">
            <StackedCounts
              entries={(data.requests_by_service ?? []).map((r) => ({
                label: r.label,
                value: r.value,
                tone: "info" as const,
              }))}
            />
          </SectionCard>
        </>
      )}

      <SectionCard title="Endpoint groups" description="Health of the API's functional groups.">
        {health.loading && !health.data ? (
          <Skeleton className="h-40 w-full" />
        ) : health.error ? (
          <p className="text-xs text-muted-foreground">Endpoint group health unavailable: {health.error}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(health.data?.groups ?? []).map((g) => (
              <div key={g.name} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{g.name}</p>
                  <HealthBadge value={g.status} />
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <p>Latency: <LatencyStat stats={g.latency} /></p>
                  <p>
                    Error rate:{" "}
                    {g.error_rate !== null && g.error_rate !== undefined ? formatPercent(g.error_rate) : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "",
    success: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
