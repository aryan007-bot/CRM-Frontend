"use client";

/**
 * Resource / Capacity dashboard (spec §36).
 *
 * Only backend-provided metrics are rendered, grouped by category, with clear
 * utilization meters ("42 / 100 workers"). The frontend never infers capacity.
 */

import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { CapacityMeter, SectionCard, UpdatedAt } from "@/components/phase4/phase4-parts";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { infraApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import type { CapacityMetrics } from "@/lib/phase4-types";

const GROUPS: { key: CapacityMetrics["metrics"][number]["category"]; title: string; description: string }[] = [
  { key: "calls", title: "Calls", description: "Active channels against backend-provided capacity." },
  { key: "workers", title: "Workers", description: "Worker pool and job queue depth." },
  { key: "ai", title: "AI", description: "Inference requests and queue depth." },
  { key: "resources", title: "Compute", description: "CPU, memory, GPU and storage utilization." },
  { key: "database", title: "Database", description: "Database load." },
];

export default function CapacityPage() {
  const capacity = useApi(() => infraApi.capacity(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:capacity")) capacity.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = capacity.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Capacity"
        description="Platform capacity and utilization. All limits are backend-provided."
        actions={<UpdatedAt at={data?.updated_at} />}
      />

      {capacity.error ? (
        <ErrorState message={capacity.error} onRetry={capacity.refresh} />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        GROUPS.map((group) => {
          const metrics = data.metrics.filter((m) => m.category === group.key);
          if (metrics.length === 0) return null;
          return (
            <SectionCard key={group.key} title={group.title} description={group.description}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.map((m) => (
                  <CapacityMeter key={m.key} label={m.label} value={m.value} max={m.max} unit={m.unit} />
                ))}
              </div>
            </SectionCard>
          );
        })
      )}
    </div>
  );
}
