"use client";

/**
 * System Overview (spec §4) — the primary Phase 4 control-plane dashboard.
 *
 * The overall status and every component state come from the backend; the UI
 * never derives or invents them. Clicking a component deep-links into its
 * Phase 4 domain page. Realtime events refresh the single health query.
 */

import { Activity } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { HealthGrid, HealthGridSkeleton, UpdatedAt, DegradedBanner, EventStreamView } from "@/components/phase4/phase4-parts";
import { SystemStateBadge } from "@/components/phase4/phase4-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { systemApi, eventsApi, operationsApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatRelative } from "@/lib/format";
import { formatCount } from "@/lib/format";
import { MetricRow } from "@/components/ops";

export default function SystemOverviewPage() {
  const health = useApi(() => systemApi.getHealth(), []);
  const operations = useApi(() => operationsApi.snapshot(), []);
  const recent = useApi(() => eventsApi.list({ page: 1, page_size: 12 }), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:system")) health.refresh();
    if (targetsForEvent(event.event).includes("phase4:operations")) {
      operations.refresh();
      recent.refresh();
    }
  };
  const { connectionState } = useLiveCallSocket({ onEvent });

  const data = health.data;
  const ops = operations.data;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="System Overview"
        description="Authoritative health for every platform component. All states are backend-reported."
        actions={
          <>
            {connectionState !== "LIVE" ? (
              <span className="text-xs text-muted-foreground">Realtime {connectionState.toLowerCase()}</span>
            ) : null}
            <UpdatedAt at={data?.updated_at} />
          </>
        }
      />

      {health.error ? (
        <ErrorState message={health.error} onRetry={health.refresh} />
      ) : !data ? (
        <HealthGridSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
            <Activity className="size-5 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs text-muted-foreground">Overall status</p>
              <div className="flex items-center gap-2">
                <SystemStateBadge value={data.state} className="h-6 text-sm" />
                {data.message ? <span className="text-sm text-muted-foreground">{data.message}</span> : null}
              </div>
            </div>
            <div className="ml-auto text-right text-xs text-muted-foreground">
              {data.updated_at ? `Last updated ${formatRelative(data.updated_at)}` : null}
            </div>
          </div>

          <HealthGrid components={data.components} />
        </>
      )}

      {/* Live operational counters (Phase 2/3 activity at infrastructure level). */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current operations</CardTitle>
        </CardHeader>
        <CardContent>
          {operations.loading && !ops ? (
            <Skeleton className="h-12 w-full" />
          ) : operations.error ? (
            <p className="text-xs text-muted-foreground">Operations snapshot unavailable: {operations.error}</p>
          ) : ops ? (
            <MetricRow
              columns="grid-cols-2 sm:grid-cols-4 xl:grid-cols-6"
              metrics={[
                { label: "Active calls", value: formatCount(ops.active_calls) },
                { label: "Queued calls", value: formatCount(ops.queued_calls) },
                { label: "Queue depth", value: formatCount(ops.queue_depth) },
                { label: "Workers", value: `${formatCount(ops.workers_available)} / ${formatCount(ops.workers_total)}` },
                { label: "Telephony", value: `${formatCount(ops.telephony_available)} / ${formatCount(ops.telephony_total)}` },
                { label: "AI providers", value: `${formatCount(ops.ai_providers_available)} / ${formatCount(ops.ai_providers_total)}` },
              ]}
            />
          ) : null}
        </CardContent>
      </Card>

      {data && needsBanner(data.message, data.state) ? <DegradedBanner message={data.message} /> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.loading && !recent.data ? (
            <Skeleton className="h-24 w-full" />
          ) : recent.error ? (
            <p className="text-xs text-muted-foreground">Event stream unavailable: {recent.error}</p>
          ) : (
            <EventStreamView events={recent.data?.items ?? []} emptyLabel="No recent events." maxRows={8} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function needsBanner(message: string | null, state: string): boolean {
  return Boolean(message) && state.toUpperCase() !== "OPERATIONAL";
}
