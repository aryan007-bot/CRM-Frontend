"use client";

/**
 * Live Operations (spec §12) — realtime operations dashboard.
 *
 * Counters and activity sections update over the existing WebSocket; the
 * snapshot endpoint is the authoritative fallback after reconnects.
 */

import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { UpdatedAt, EventStreamView, SectionCard } from "@/components/phase4/phase4-parts";
import { MetricRow } from "@/components/ops";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { operationsApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatCount } from "@/lib/format";

export default function LiveOperationsPage() {
  const snapshot = useApi(() => operationsApi.snapshot(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:operations")) snapshot.refresh();
  };
  const { connectionState } = useLiveCallSocket({ onEvent });

  const data = snapshot.data;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Live Operations"
        description="Realtime view of calling, queueing, workers and AI activity. Updates arrive over the existing realtime socket."
        actions={
          <>
            {connectionState !== "LIVE" ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                Realtime connection interrupted.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
                Live
              </span>
            )}
            <UpdatedAt at={data?.updated_at} />
          </>
        }
      />

      {snapshot.error ? (
        <ErrorState message={snapshot.error} onRetry={snapshot.refresh} />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <MetricRow
            columns="grid-cols-2 sm:grid-cols-4 xl:grid-cols-6"
            metrics={[
              { label: "Active calls", value: formatCount(data.active_calls), href: "/live-calls" },
              { label: "Queued calls", value: formatCount(data.queued_calls), href: "/infrastructure/queues/dial_queue" },
              { label: "Completed calls", value: formatCount(data.completed_calls) },
              { label: "Failed calls", value: formatCount(data.failed_calls) },
              { label: "AI conversations", value: formatCount(data.ai_conversations) },
              { label: "Human transfers", value: formatCount(data.human_transfers) },
              { label: "Pending analysis", value: formatCount(data.pending_analysis), href: "/infrastructure/queues/analysis_queue" },
              { label: "Pending follow-ups", value: formatCount(data.pending_follow_ups), href: "/automation" },
              { label: "Queue depth", value: formatCount(data.queue_depth), href: "/infrastructure/queues" },
              {
                label: "Workers",
                value: `${formatCount(data.workers_available)} / ${formatCount(data.workers_total)}`,
                href: "/infrastructure/workers",
              },
              {
                label: "Telephony",
                value: `${formatCount(data.telephony_available)} / ${formatCount(data.telephony_total)}`,
                href: "/infrastructure/telephony",
              },
              {
                label: "AI providers",
                value: `${formatCount(data.ai_providers_available)} / ${formatCount(data.ai_providers_total)}`,
                href: "/ai/providers",
              },
            ]}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Worker activity"
              description="Availability of the background worker pool."
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/infrastructure/workers">Open workers</Link>
                </Button>
              }
            >
              <p className="text-sm text-muted-foreground">
                {formatCount(data.workers_available)} of {formatCount(data.workers_total)} workers available.
              </p>
            </SectionCard>

            <SectionCard
              title="Telephony activity"
              description="Gateway availability from the telephony infrastructure view."
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/infrastructure/telephony">Open telephony</Link>
                </Button>
              }
            >
              <p className="text-sm text-muted-foreground">
                {formatCount(data.telephony_available)} of {formatCount(data.telephony_total)} gateways available.
              </p>
            </SectionCard>
          </div>

          <SectionCard
            title="Recent events"
            description="Latest platform events across categories."
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/operations/events">Full stream</Link>
              </Button>
            }
          >
            <EventStreamView events={data.recent_events ?? []} emptyLabel="No events yet." maxRows={10} />
          </SectionCard>
        </>
      )}
    </div>
  );
}
