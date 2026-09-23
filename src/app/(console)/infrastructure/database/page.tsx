"use client";

/**
 * Database Health (spec §53).
 *
 * Connection, latency, pool utilization, migrations and storage — all
 * backend-reported. Credentials and connection strings are never exposed.
 */

import { Database } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { LatencyStat, SectionCard, UpdatedAt, CapacityMeter } from "@/components/phase4/phase4-parts";
import { HealthBadge } from "@/components/phase4/phase4-badges";
import { DetailField } from "@/components/ops";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { infraApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatBytes } from "@/lib/phase4-format";
import { formatCount } from "@/lib/format";

export default function DatabaseHealthPage() {
  const db = useApi(() => infraApi.database(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:database")) db.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = db.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Database"
        description="PostgreSQL health, connection pool and migration status. Credentials are never displayed."
        actions={<UpdatedAt at={data?.updated_at} />}
      />

      {db.error ? (
        <ErrorState message={db.error} onRetry={db.refresh} />
      ) : !data ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <Database className="size-5 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs text-muted-foreground">Connection</p>
              <div className="flex items-center gap-2">
                <HealthBadge value={data.state} className="h-6 text-sm" />
                <span className="text-sm text-muted-foreground">
                  {data.connected ? "Connected" : data.connected === false ? "Not connected" : "Unknown"}
                </span>
              </div>
            </div>
          </div>

          <SectionCard title="Metrics">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <DetailField label="Version" value={data.version ?? "—"} />
              <DetailField label="Migration status" value={data.migration_status ?? "—"} />
              <DetailField label="Active connections" value={formatCount(data.active_connections)} />
              <DetailField label="Slow queries" value={formatCount(data.slow_queries)} />
              <DetailField label="Latency" value={<LatencyStat stats={data.latency} />} />
            </div>
          </SectionCard>

          <SectionCard title="Utilization">
            <div className="grid gap-4 sm:grid-cols-2">
              <CapacityMeter
                label="Connection pool"
                value={data.pool_utilization !== null ? Math.round(data.pool_utilization * 100) : null}
                max={100}
                unit="%"
              />
              {data.storage ? (
                <CapacityMeter
                  label="Storage"
                  value={data.storage.used_bytes}
                  max={data.storage.total_bytes}
                  unit=""
                />
              ) : (
                <p className="text-xs text-muted-foreground">Storage metrics are not reported.</p>
              )}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
